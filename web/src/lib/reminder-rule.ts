// Auto-reminder schedule (CP-02). Pure, so it can be tested without a database.
import { daysBetween, istDay, type OpenDue } from "./ledger";

export type Channel = "WHATSAPP" | "SMS" | "EMAIL";
export const CHANNELS: Channel[] = ["WHATSAPP", "SMS", "EMAIL"];

export type ReminderRule = {
  daysBefore: number | null; // remind N days before a due date
  onDue: boolean; // remind on the due date
  everyDaysAfter: number | null; // once overdue, remind every N days
  channel: Channel;
};

type RuleSource = {
  reminderDaysBefore: number | null;
  reminderOnDue: boolean | null;
  reminderEveryDaysAfter: number | null;
  reminderChannel: string | null;
};

/** The rule that applies to a party, or null when auto-reminders are off for it. */
export function effectiveRule(
  business: RuleSource & { reminderEnabled: boolean },
  party: RuleSource & { reminderMode: string },
): ReminderRule | null {
  if (party.reminderMode === "OFF") return null;
  if (party.reminderMode === "CUSTOM") {
    return {
      daysBefore: party.reminderDaysBefore,
      onDue: party.reminderOnDue ?? false,
      everyDaysAfter: party.reminderEveryDaysAfter,
      channel: (party.reminderChannel as Channel) ?? (business.reminderChannel as Channel),
    };
  }
  if (!business.reminderEnabled) return null;
  return {
    daysBefore: business.reminderDaysBefore,
    onDue: business.reminderOnDue ?? false,
    everyDaysAfter: business.reminderEveryDaysAfter,
    channel: business.reminderChannel as Channel,
  };
}

export function describeRule(r: ReminderRule | null): string {
  if (!r) return "off";
  const parts = [
    r.daysBefore ? `${r.daysBefore} days before due` : null,
    r.onDue ? "on the due date" : null,
    r.everyDaysAfter ? `every ${r.everyDaysAfter} days when overdue` : null,
  ].filter(Boolean);
  const by = { WHATSAPP: "WhatsApp", SMS: "SMS", EMAIL: "email" }[r.channel];
  return parts.length ? `${parts.join(", ")}, by ${by}` : "no reminders scheduled";
}

/**
 * Why a reminder is due today, or null. At most one reminder per party per day:
 * the caller passes the last auto-reminder time so reruns of the job are harmless.
 */
export function reminderReason(rule: ReminderRule, dues: OpenDue[], today: Date, lastSent: Date | null): string | null {
  if (lastSent && istDay(lastSent) === istDay(today)) return null;
  for (const d of dues) {
    const until = daysBetween(today, d.due); // > 0: due in future, < 0: overdue
    if (rule.daysBefore && until === rule.daysBefore) return `due in ${until} days`;
    if (rule.onDue && until === 0) return "due today";
    if (rule.everyDaysAfter && until < 0 && -until % rule.everyDaysAfter === 0) return `${-until} days overdue`;
  }
  return null;
}
