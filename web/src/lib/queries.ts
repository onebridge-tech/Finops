import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { ageing, balanceOf, openDues, overdueAmount } from "./ledger";
import { partyWhere, type Ctx } from "./auth";

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
export async function partiesWithBalance(ctx: Ctx, opts: { q?: string; where?: Prisma.PartyWhereInput } = {}) {
  const q = opts.q?.trim();
  const [parties, balances] = await Promise.all([
    db.party.findMany({
      where: {
        AND: [
          partyWhere(ctx),
          { archivedAt: null },
          opts.where ?? {},
          q ? { OR: [{ name: { contains: q } }, { phone: { contains: q } }, { gstin: { contains: q.toUpperCase() } }] } : {},
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

  const overdue = receivable
    .map((p) => ({ ...p, overdue: overdueAmount(byParty.get(p.id) ?? [], now) }))
    .filter((p) => p.overdue > 0)
    .sort((a, b) => b.overdue - a.overdue);

  // Today's real activity: excludes opening balances, reversals and entries that were reversed.
  const today = await db.ledgerEntry.findMany({
    where: { ...entryWhere(ctx, ids), createdAt: { gte: startOfTodayIST() }, source: { notIn: ["REVERSAL", "OPENING"] }, reversedBy: null },
    select: { direction: true, amountPaise: true, paymentMode: true, createdById: true, party: { select: { type: true } } },
  });
  const sum = (rows: typeof today) => rows.reduce((s, t) => s + Number(t.amountPaise), 0);
  const collected = today.filter((t) => t.direction === "GOT" && t.paymentMode);

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
    todayGave: sum(today.filter((t) => t.direction === "GAVE")),
    todayGot: sum(collected),
    cashToday: sum(collected.filter((t) => t.paymentMode === "CASH")),
    upiToday: sum(collected.filter((t) => t.paymentMode === "UPI")),
    activity,
    recent,
  };
}

/** Receivable parties with their open dues, for the collections screen (LG-04, CP-03). */
export async function collections(ctx: Ctx) {
  const parties = (await partiesWithBalance(ctx)).filter((p) => p.balance > 0);
  const entries = await db.ledgerEntry.findMany({ where: { businessId: ctx.business.id, partyId: { in: parties.map((p) => p.id) } } });
  const byParty = Map.groupBy(entries, (e) => e.partyId);
  const now = new Date();
  return parties.map((p) => {
    const es = byParty.get(p.id) ?? [];
    const dues = openDues(es);
    const age = ageing(es, now);
    return { ...p, dues, ageing: age, overdue: Object.values(age).reduce((a, b) => a + b, 0) };
  });
}

export async function partyLedger(ctx: Ctx, partyId: string) {
  const party = await db.party.findFirst({ where: { ...partyWhere(ctx), id: partyId } });
  if (!party) return null;
  const entries = await db.ledgerEntry.findMany({ where: { partyId, businessId: ctx.business.id }, orderBy: [{ date: "asc" }, { createdAt: "asc" }] });
  return { party, entries, balance: balanceOf(entries), overdue: overdueAmount(entries, new Date()) };
}
