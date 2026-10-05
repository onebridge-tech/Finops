import "server-only";
import { db } from "./db";
import { balanceOf, openDues } from "./ledger";
import { effectiveRule, reminderReason } from "./reminder-rule";
import { appUrl } from "./share";
import { sendToParty } from "./messaging/send";

export type RunSummary = { checked: number; sent: number; skipped: number; failed: number; outsideHours?: boolean };

/** Messages go out only between 9 am and 8 pm IST. */
export function withinSendingHours(now: Date): boolean {
  const hour = Number(now.toLocaleString("en-GB", { hour: "2-digit", hour12: false, timeZone: "Asia/Kolkata" }));
  return hour >= 9 && hour < 20;
}

/**
 * Sends today's scheduled reminders (CP-02). Safe to run as often as you like:
 * each party gets at most one auto-reminder per day.
 */
export async function runAutoReminders(opts: { now?: Date; businessId?: string; ignoreHours?: boolean } = {}): Promise<RunSummary> {
  const now = opts.now ?? new Date();
  const summary: RunSummary = { checked: 0, sent: 0, skipped: 0, failed: 0 };
  if (!opts.ignoreHours && !withinSendingHours(now)) return { ...summary, outsideHours: true };

  const businesses = await db.business.findMany({ where: opts.businessId ? { id: opts.businessId } : {} });
  for (const business of businesses) {
    const parties = await db.party.findMany({
      where: {
        businessId: business.id, archivedAt: null, disputedAt: null, consentAt: { not: null },
        reminderMode: business.reminderEnabled ? { not: "OFF" } : "CUSTOM",
      },
    });
    for (const party of parties) {
      const rule = effectiveRule(business, party);
      if (!rule) continue;
      summary.checked++;
      const entries = await db.ledgerEntry.findMany({ where: { partyId: party.id } });
      const balance = balanceOf(entries);
      if (balance <= 0) continue; // paid up: reminders pause by themselves
      if (!reminderReason(rule, openDues(entries), now, party.lastAutoReminderAt)) continue;

      const r = await sendToParty({
        business, party, kind: "REMINDER", channel: rule.channel, trigger: "AUTO",
        vars: { balancePaise: balance, link: appUrl(`/s/${party.shareToken}`) },
      });
      await db.party.update({ where: { id: party.id }, data: { lastAutoReminderAt: now } });
      if (r.ok) summary.sent++;
      else if (r.status === "SKIPPED") summary.skipped++;
      else summary.failed++;
    }
  }
  return summary;
}
