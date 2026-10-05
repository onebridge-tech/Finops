import "server-only";
import { db } from "./db";
import { balanceOf, overdueAmount } from "./ledger";

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

export async function partiesWithBalance(businessId: string, q?: string) {
  const [parties, balances] = await Promise.all([
    db.party.findMany({
      where: { businessId, archivedAt: null, ...(q ? { OR: [{ name: { contains: q } }, { phone: { contains: q } }] } : {}) },
      orderBy: { name: "asc" },
    }),
    balancesByParty(businessId),
  ]);
  return parties.map((p) => ({ ...p, balance: balances.get(p.id) ?? 0 }));
}

// Phase 1: computes overdue in memory per receivable party. Move to SQL once
// businesses exceed a few thousand active parties.
export async function dashboard(businessId: string) {
  const parties = await partiesWithBalance(businessId);
  const receivable = parties.filter((p) => p.balance > 0);
  const now = new Date();
  const entries = await db.ledgerEntry.findMany({
    where: { businessId, partyId: { in: receivable.map((p) => p.id) } },
  });
  const byParty = new Map<string, typeof entries>();
  for (const e of entries) byParty.set(e.partyId, [...(byParty.get(e.partyId) ?? []), e]);

  const overdue = receivable
    .map((p) => ({ ...p, overdue: overdueAmount(byParty.get(p.id) ?? [], now) }))
    .filter((p) => p.overdue > 0)
    .sort((a, b) => b.overdue - a.overdue);

  const startOfToday = new Date(new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }) + "T00:00:00+05:30");
  // Today's real activity: excludes opening balances, reversals and entries that were reversed.
  const today = await db.ledgerEntry.findMany({
    where: { businessId, createdAt: { gte: startOfToday }, source: { notIn: ["REVERSAL", "OPENING"] }, reversedBy: null },
    select: { direction: true, amountPaise: true },
  });
  const todaySum = (d: string) => today.filter((t) => t.direction === d).reduce((s, t) => s + Number(t.amountPaise), 0);

  const recent = await db.ledgerEntry.findMany({
    where: { businessId },
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
    todayGave: todaySum("GAVE"),
    todayGot: todaySum("GOT"),
    recent,
  };
}

export async function partyLedger(businessId: string, partyId: string) {
  const party = await db.party.findFirst({ where: { id: partyId, businessId } });
  if (!party) return null;
  const entries = await db.ledgerEntry.findMany({ where: { partyId, businessId }, orderBy: [{ date: "asc" }, { createdAt: "asc" }] });
  return { party, entries, balance: balanceOf(entries), overdue: overdueAmount(entries, new Date()) };
}
