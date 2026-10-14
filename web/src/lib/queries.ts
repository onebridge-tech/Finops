import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { istDay, ageing, balanceOf, openByEntry, openDues, overdueAmount } from "./ledger";
import { docWhere, partyWhere, type Ctx } from "./auth";

/** Bill-wise allocations for a business, grouped by party (CP-10). */
export async function allocationsByParty(businessId: string, partyIds?: string[]) {
  const rows = await db.allocation.findMany({ where: { businessId, ...(partyIds ? { partyId: { in: partyIds } } : {}) } });
  return Map.groupBy(rows, (a) => a.partyId);
}

/** Balance per party for a business, derived from entries (never stored). */
export async function balancesByParty(businessId: string): Promise<Map<string, number>> {
  const rows = await db.ledgerEntry.groupBy({
    by: ["partyId", "direction"],
    where: { businessId },
    _sum: { amountPaise: true },
  });
  const map = new Map<string, number>();
  for (const r of rows) {
    const amt = Number(r._sum.amountPaise ?? 0n);
    map.set(r.partyId, (map.get(r.partyId) ?? 0) + (r.direction === "GAVE" ? amt : -amt));
  }
  return map;
}

/** Parties this member can see, with balances. */
export async function partiesWithBalance(ctx: Ctx, opts: { q?: string; where?: Prisma.PartyWhereInput; includeArchived?: boolean } = {}) {
  const q = opts.q?.trim();
  const [parties, balances] = await Promise.all([
    db.party.findMany({
      where: {
        AND: [
          partyWhere(ctx),
          opts.includeArchived ? {} : { archivedAt: null },
          opts.where ?? {},
          q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { phone: { contains: q, mode: "insensitive" } }, { gstin: { contains: q.toUpperCase(), mode: "insensitive" } }] } : {},
        ],
      },
      orderBy: { name: "asc" },
    }),
    balancesByParty(ctx.business.id),
  ]);
  return parties.map((p) => ({ ...p, balance: balances.get(p.id) ?? 0 }));
}

const startOfTodayIST = () => new Date(new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }) + "T00:00:00+05:30");

/** Entries this member's view covers: visible parties, and the active branch if one is picked. */
function entryWhere(ctx: Ctx, partyIds: string[]): Prisma.LedgerEntryWhereInput {
  return { businessId: ctx.business.id, partyId: { in: partyIds }, ...(ctx.branchId ? { branchId: ctx.branchId } : {}) };
}

// Phase 1: computes overdue in memory per receivable party. Move to SQL once
// businesses exceed a few thousand active parties.
export async function dashboard(ctx: Ctx) {
  const parties = await partiesWithBalance(ctx);
  const ids = parties.map((p) => p.id);
  const receivable = parties.filter((p) => p.balance > 0);
  const now = new Date();
  const entries = await db.ledgerEntry.findMany({ where: { businessId: ctx.business.id, partyId: { in: receivable.map((p) => p.id) } } });
  const byParty = Map.groupBy(entries, (e) => e.partyId);
  const allocs = await allocationsByParty(ctx.business.id, receivable.map((p) => p.id));

  const overdue = receivable
    .map((p) => ({ ...p, overdue: overdueAmount(byParty.get(p.id) ?? [], now, allocs.get(p.id) ?? []) }))
    .filter((p) => p.overdue > 0)
    .sort((a, b) => b.overdue - a.overdue);

  // Today's real activity: excludes opening balances, reversals and entries that were reversed.
  const today = await db.ledgerEntry.findMany({
    where: { ...entryWhere(ctx, ids), createdAt: { gte: startOfTodayIST() }, source: { notIn: ["REVERSAL", "OPENING"] }, reversedBy: null },
    select: { direction: true, amountPaise: true, paymentMode: true, createdById: true, party: { select: { type: true } } },
  });
  const sum = (rows: typeof today) => rows.reduce((s, t) => s + Number(t.amountPaise), 0);
  const collected = today.filter((t) => t.direction === "GOT" && t.paymentMode);

  const weekStart = new Date(`${istDay(new Date(Date.now() - 6 * 86400_000))}T00:00:00+05:30`);
  const weekRows = await db.ledgerEntry.findMany({
    where: { ...entryWhere(ctx, ids), createdAt: { gte: weekStart }, source: { notIn: ["REVERSAL", "OPENING"] }, reversedBy: null },
    select: { direction: true, amountPaise: true, paymentMode: true, createdAt: true },
  });
  const week = Array.from({ length: 7 }, (_, i) => {
    const day = istDay(new Date(Date.now() - (6 - i) * 86400_000));
    const rows = weekRows.filter((r) => istDay(r.createdAt) === day);
    return {
      day,
      got: rows.filter((r) => r.direction === "GOT" && r.paymentMode).reduce((s, r) => s + Number(r.amountPaise), 0),
      gave: rows.filter((r) => r.direction === "GAVE").reduce((s, r) => s + Number(r.amountPaise), 0),
    };
  });

  // Who did what today (IR-01 rep activity).
  const byUser = Map.groupBy(today, (t) => t.createdById);
  const members = await db.membership.findMany({ where: { businessId: ctx.business.id, userId: { in: [...byUser.keys()] } }, include: { user: true } });
  const activity = [...byUser.entries()].map(([userId, rows]) => {
    const m = members.find((x) => x.userId === userId);
    return {
      userId, name: m ? (m.user.name ?? `+${m.user.phone}`) : "Former member", role: m?.role ?? "",
      entries: rows.length, gave: sum(rows.filter((r) => r.direction === "GAVE")), collected: sum(rows.filter((r) => r.direction === "GOT" && r.paymentMode)),
    };
  }).sort((a, b) => b.collected - a.collected);

  const endOfToday = new Date(new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }) + "T23:59:59+05:30");
  const monthStart = new Date(new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }).slice(0, 8) + "01T00:00:00+05:30");
  const [followUpsDue, openQuotes, gst] = await Promise.all([
    db.followUp.count({ where: { businessId: ctx.business.id, assignedToId: ctx.user.id, doneAt: null, dueAt: { lte: endOfToday }, party: partyWhere(ctx) } }),
    db.quote.aggregate({ where: { ...docWhere(ctx), status: { in: ["OPEN", "ACCEPTED"] } }, _count: true, _sum: { totalPaise: true } }),
    // Output GST on this month's invoices, for the accountant view.
    db.invoice.aggregate({
      where: { ...docWhere(ctx), status: "ISSUED", date: { gte: monthStart } },
      _count: true, _sum: { taxablePaise: true, cgstPaise: true, sgstPaise: true, igstPaise: true },
    }),
  ]);

  const recent = await db.ledgerEntry.findMany({
    where: entryWhere(ctx, ids),
    orderBy: { createdAt: "desc" },
    take: 8,
    include: { party: { select: { name: true } } },
  });

  return {
    toCollect: receivable.reduce((s, p) => s + p.balance, 0),
    toPay: parties.filter((p) => p.balance < 0).reduce((s, p) => s - p.balance, 0),
    overdueTotal: overdue.reduce((s, p) => s + p.overdue, 0),
    overdue: overdue.slice(0, 10),
    partyCount: parties.length,
    week,
    todayGave: sum(today.filter((t) => t.direction === "GAVE")),
    todayGot: sum(collected),
    cashToday: sum(collected.filter((t) => t.paymentMode === "CASH")),
    upiToday: sum(collected.filter((t) => t.paymentMode === "UPI")),
    activity,
    recent,
    followUpsDue,
    openQuotes: { count: openQuotes._count, totalPaise: Number(openQuotes._sum.totalPaise ?? 0n) },
    gstMonth: {
      invoices: gst._count,
      taxable: Number(gst._sum.taxablePaise ?? 0n),
      cgst: Number(gst._sum.cgstPaise ?? 0n), sgst: Number(gst._sum.sgstPaise ?? 0n), igst: Number(gst._sum.igstPaise ?? 0n),
    },
  };
}

/** Receivable parties with their open dues, for the collections screen (LG-04, CP-03). */
export async function collections(ctx: Ctx) {
  const parties = (await partiesWithBalance(ctx)).filter((p) => p.balance > 0);
  const entries = await db.ledgerEntry.findMany({ where: { businessId: ctx.business.id, partyId: { in: parties.map((p) => p.id) } } });
  const byParty = Map.groupBy(entries, (e) => e.partyId);
  const allocs = await allocationsByParty(ctx.business.id, parties.map((p) => p.id));
  const now = new Date();
  return parties.map((p) => {
    const es = byParty.get(p.id) ?? [];
    const al = allocs.get(p.id) ?? [];
    const dues = openDues(es, al);
    const age = ageing(es, now, al);
    return { ...p, dues, ageing: age, overdue: Object.values(age).reduce((a, b) => a + b, 0) };
  });
}

export type InvoicePay = { open: number; total: number; status: "PAID" | "PART" | "UNPAID" | "CANCELLED" };

/** Paid / part-paid / unpaid for each invoice, from its ledger entry and the receipts settling it (CP-10). */
export async function invoicePayments(businessId: string, invoices: { id: string; partyId: string; totalPaise: bigint; status: string }[]) {
  const out = new Map<string, InvoicePay>();
  const live = invoices.filter((i) => i.status !== "CANCELLED");
  for (const i of invoices) if (i.status === "CANCELLED") out.set(i.id, { open: 0, total: Number(i.totalPaise), status: "CANCELLED" });
  if (live.length === 0) return out;
  const partyIds = [...new Set(live.map((i) => i.partyId))];
  const [entries, allocs] = await Promise.all([
    db.ledgerEntry.findMany({ where: { businessId, partyId: { in: partyIds } } }),
    allocationsByParty(businessId, partyIds),
  ]);
  const byParty = Map.groupBy(entries, (e) => e.partyId);
  const invoiceEntry = new Map(entries.filter((e) => e.source === "INVOICE" && e.invoiceId).map((e) => [e.invoiceId!, e.id]));
  for (const pid of partyIds) {
    const open = openByEntry(byParty.get(pid) ?? [], allocs.get(pid) ?? []);
    for (const inv of live.filter((i) => i.partyId === pid)) {
      const eid = invoiceEntry.get(inv.id);
      const left = eid ? (open.get(eid) ?? 0) : Number(inv.totalPaise);
      const total = Number(inv.totalPaise);
      out.set(inv.id, { open: left, total, status: left === 0 ? "PAID" : left < total ? "PART" : "UNPAID" });
    }
  }
  return out;
}

export async function partyLedger(ctx: Ctx, partyId: string) {
  const party = await db.party.findFirst({ where: { ...partyWhere(ctx), id: partyId } });
  if (!party) return null;
  const entries = await db.ledgerEntry.findMany({ where: { partyId, businessId: ctx.business.id }, orderBy: [{ date: "asc" }, { createdAt: "asc" }] });
  const allocations = await db.allocation.findMany({ where: { partyId, businessId: ctx.business.id } });
  return { party, entries, allocations, balance: balanceOf(entries), overdue: overdueAmount(entries, new Date(), allocations) };
}
