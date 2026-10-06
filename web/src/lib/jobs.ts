import "server-only";
import { db } from "./db";
import { balanceOf, daysBetween, istDay } from "./ledger";
import { formatINR } from "./money";
import { translator } from "./i18n";
import { sendToOwner } from "./messaging/send";
import { runAutoReminders } from "./reminders";
import { collections } from "./queries";
import { buysFewerCategories } from "./rules";
import { stockLevels } from "./reports2";
import type { Channel } from "./reminder-rule";
import { autoAcceptShared } from "./shared-ledger";
import type { Ctx } from "./auth";

// Scheduled work, run hourly (see instrumentation.ts and /api/cron/reminders).
// Every job is safe to run as often as you like: each one checks whether its
// work for the day has already been done.

const INACTIVE_DAYS = 60;
const hourIST = (now: Date) => Number(now.toLocaleString("en-GB", { hour: "2-digit", hour12: false, timeZone: "Asia/Kolkata" }));
const weekdayIST = (now: Date) => new Date(`${istDay(now)}T12:00:00+05:30`).getUTCDay();

/** Owners' summary of the day so far (IR-09). Sent from 8 am IST, once a day or once on Monday. */
export async function runDigests(now = new Date(), opts: { force?: boolean; businessId?: string } = {}) {
  const sent = { digests: 0, skipped: 0 };
  if (!opts.force && hourIST(now) < 8) return sent;
  const today = istDay(now);
  const startOfToday = new Date(`${today}T00:00:00+05:30`);
  const businesses = await db.business.findMany({ where: { digestFrequency: { in: opts.force ? ["DAILY", "WEEKLY", "OFF"] : ["DAILY", "WEEKLY"] }, ...(opts.businessId ? { id: opts.businessId } : {}) } });
  for (const b of businesses) {
    if (!opts.force && b.digestFrequency === "WEEKLY" && weekdayIST(now) !== 1) continue;
    const already = await db.message.count({ where: { businessId: b.id, kind: "DIGEST", createdAt: { gte: startOfToday } } });
    if (already && !opts.force) continue;
    const owners = await db.membership.findMany({ where: { businessId: b.id, role: "OWNER" }, include: { user: true } });
    for (const o of owners) {
      const t = translator(o.user.uiLanguage);
      const ctx = { business: b, branchId: null, assignedOnly: false, user: o.user, membership: o, role: "OWNER" } as unknown as Ctx;
      const parties = await collections(ctx);
      const toCollect = parties.reduce((s, p) => s + p.balance, 0);
      const overdue = parties.reduce((s, p) => s + p.overdue, 0);
      const since = b.digestFrequency === "WEEKLY" ? new Date(startOfToday.getTime() - 7 * 86400_000) : new Date(startOfToday.getTime() - 86400_000);
      const received = await db.ledgerEntry.findMany({ where: { businessId: b.id, direction: "GOT", paymentMode: { not: null }, createdAt: { gte: since }, reversedBy: null, source: { not: "REVERSAL" } }, select: { amountPaise: true } });
      const followUps = await db.followUp.count({ where: { businessId: b.id, doneAt: null, dueAt: { lte: new Date(`${today}T23:59:59+05:30`) } } });
      const low = (await stockLevels(ctx)).filter((r) => r.low).length;
      const body = [
        `${b.name} · ${today}`,
        `${t("dash.collectedToday")} (${b.digestFrequency === "WEEKLY" ? "7d" : "24h"}): ${formatINR(received.reduce((s, e) => s + Number(e.amountPaise), 0))}`,
        `${t("dash.toCollect")}: ${formatINR(toCollect)}`,
        `${t("dash.overdue")}: ${formatINR(overdue)}`,
        `${t("dash.followUpsDue")}: ${followUps}`,
        ...(low ? [`Low stock: ${low} item${low === 1 ? "" : "s"}`] : []),
      ].join("\n");
      const r = await sendToOwner({ business: b, to: { phone: o.user.phone, email: b.email }, channel: b.digestChannel as Channel, kind: "DIGEST", subject: `Daily summary · ${b.name}`, body, userId: o.userId });
      if (r.ok) sent.digests++; else sent.skipped++;
    }
  }
  return sent;
}

/**
 * Tasks for the assigned rep (IR-04): customers who haven't ordered in a while,
 * and customers buying from far fewer categories than their peers.
 */
export async function runInactiveScan(now = new Date(), businessId?: string) {
  const result = { inactive: 0, upsell: 0 };
  const businesses = await db.business.findMany({ where: businessId ? { id: businessId } : {} });
  for (const b of businesses) {
    const owner = await db.membership.findFirst({ where: { businessId: b.id, role: "OWNER" }, orderBy: { createdAt: "asc" } });
    if (!owner) continue;
    const parties = await db.party.findMany({ where: { businessId: b.id, archivedAt: null, type: { in: ["CUSTOMER", "BOTH"] }, disputedAt: null } });
    if (parties.length === 0) continue;
    const [invoices, orders, lines, items, recent] = await Promise.all([
      db.invoice.findMany({ where: { businessId: b.id, status: "ISSUED" }, select: { partyId: true, date: true } }),
      db.order.findMany({ where: { businessId: b.id, kind: "SALES", status: { not: "CANCELLED" } }, select: { partyId: true, date: true } }),
      db.invoiceLine.findMany({ where: { invoice: { businessId: b.id, status: "ISSUED", date: { gte: new Date(now.getTime() - 365 * 86400_000) } } }, select: { itemId: true, invoice: { select: { partyId: true } } } }),
      db.item.findMany({ where: { businessId: b.id }, select: { id: true, category: true } }),
      db.followUp.findMany({ where: { businessId: b.id, source: { in: ["INACTIVE", "UPSELL"] }, OR: [{ doneAt: null }, { createdAt: { gte: new Date(now.getTime() - INACTIVE_DAYS * 86400_000) } }] }, select: { partyId: true, source: true } }),
    ]);
    const last = new Map<string, Date>();
    for (const x of [...invoices, ...orders]) if (!last.has(x.partyId) || last.get(x.partyId)! < x.date) last.set(x.partyId, x.date);
    const category = new Map(items.map((i) => [i.id, i.category]));
    const cats = new Map<string, Set<string>>();
    for (const l of lines) {
      const c = l.itemId ? category.get(l.itemId) : null;
      if (c) (cats.get(l.invoice.partyId) ?? cats.set(l.invoice.partyId, new Set()).get(l.invoice.partyId)!).add(c);
    }
    const peers = parties.filter((p) => last.has(p.id)).map((p) => cats.get(p.id)?.size ?? 0);
    const has = (pid: string, src: string) => recent.some((r) => r.partyId === pid && r.source === src);
    const due = new Date(`${istDay(now)}T10:00:00+05:30`);

    for (const p of parties) {
      const lastOrder = last.get(p.id);
      if (!lastOrder) continue;
      const days = daysBetween(lastOrder, now);
      const assignee = p.ownerId ?? owner.userId;
      if (days >= INACTIVE_DAYS && !has(p.id, "INACTIVE")) {
        await db.followUp.create({ data: { businessId: b.id, partyId: p.id, assignedToId: assignee, dueAt: due, source: "INACTIVE", note: `No order in ${days} days — call to check in`, createdById: assignee } });
        result.inactive++;
      } else if (days < INACTIVE_DAYS && buysFewerCategories(cats.get(p.id)?.size ?? 0, peers) && !has(p.id, "UPSELL")) {
        await db.followUp.create({ data: { businessId: b.id, partyId: p.id, assignedToId: assignee, dueAt: due, source: "UPSELL", note: `Buys from only ${cats.get(p.id)?.size ?? 0} categories — most customers buy from more. Suggest other products`, createdById: assignee } });
        result.upsell++;
      }
    }
  }
  return result;
}

/** Everything scheduled, in one call. */
export async function runHourly(now = new Date()) {
  const reminders = await runAutoReminders({ now });
  const digests = await runDigests(now);
  const tasks = hourIST(now) >= 9 ? await runInactiveScan(now) : { inactive: 0, upsell: 0 };
  const shared = await autoAcceptShared(now);
  return { reminders, digests, tasks, shared };
}

export { balanceOf };
