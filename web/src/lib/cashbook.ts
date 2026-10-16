import "server-only";
import { db } from "./db";
import type { Ctx } from "./auth";
import { istDay } from "./ledger";
import { cashRunning, type CashMove } from "./rules";

// Cashbook (LG-08). Cash in hand is derived, never typed in:
//   in:  cash receipts from parties, manual "cash in" adjustments
//   out: cash payments to suppliers, cash expenses, manual "cash out" adjustments
// A reversed cash entry is cancelled by a move on the day it was reversed, so a
// day that has already been counted keeps its figures.

export const dayStart = (ymd: string) => new Date(`${ymd}T00:00:00+05:30`);
export const dayEnd = (ymd: string) => new Date(`${ymd}T23:59:59.999+05:30`);

type Scope = { branchId: string | null }; // null = every branch the member can see

async function allMoves(ctx: Ctx, scope: Scope, until: Date): Promise<(CashMove & { day: string })[]> {
  const biz = ctx.business.id;
  const branch = scope.branchId ? { branchId: scope.branchId } : {};
  const [cashEntries, expenses, adj, parties, cashSales] = await Promise.all([
    db.ledgerEntry.findMany({ where: { businessId: biz, ...branch, paymentMode: "CASH", date: { lte: until } } }),
    db.expense.findMany({ where: { businessId: biz, ...branch, paymentMode: "CASH", voidedAt: null, date: { lte: until } } }),
    db.cashAdjustment.findMany({ where: { businessId: biz, ...branch, voidedAt: null, date: { lte: until } } }),
    db.party.findMany({ where: { businessId: biz }, select: { id: true, name: true } }),
    db.cashSale.findMany({ where: { businessId: biz, ...branch, paymentMode: "CASH", voidedAt: null, date: { lte: until } } }),
  ]);
  const pn = new Map(parties.map((p) => [p.id, p.name]));
  const reversals = cashEntries.length
    ? await db.ledgerEntry.findMany({ where: { businessId: biz, source: "REVERSAL", reversalOfId: { in: cashEntries.map((e) => e.id) }, date: { lte: until } } })
    : [];
  const byId = new Map(cashEntries.map((e) => [e.id, e]));

  const moves: (CashMove & { day: string })[] = [];
  const add = (at: Date, direction: "IN" | "OUT", amount: bigint, label: string, ref?: string) =>
    moves.push({ at, day: istDay(at), direction, amountPaise: Number(amount), label, ref });

  for (const e of cashEntries) {
    // GOT = money in from the party; GAVE with a cash mode = cash paid out to a supplier.
    add(e.date, e.direction === "GOT" ? "IN" : "OUT", e.amountPaise, `${e.direction === "GOT" ? "Received from" : "Paid to"} ${pn.get(e.partyId) ?? "party"}${e.note ? " · " + e.note : ""}`, `/parties/${e.partyId}`);
  }
  for (const r of reversals) {
    const orig = byId.get(r.reversalOfId!);
    if (orig) add(r.date, orig.direction === "GOT" ? "OUT" : "IN", r.amountPaise, `Reversed: ${orig.direction === "GOT" ? "receipt from" : "payment to"} ${pn.get(orig.partyId) ?? "party"}`, `/parties/${orig.partyId}`);
  }
  for (const x of expenses) add(x.date, "OUT", x.amountPaise, `Expense · ${x.category}${x.note ? " · " + x.note : ""}`, "/expenses");
  for (const x of cashSales) add(x.date, "IN", x.amountPaise, `Cash sale · ${x.item}`, "/cash-sales");
  for (const x of adj) add(x.date, x.direction as "IN" | "OUT", x.amountPaise, `Cash adjustment · ${x.note}`);
  return moves;
}

export type CashDay = { date: string; opening: number; in: number; out: number; closing: number; close: { counted: number; difference: number; note: string | null } | null };

/** Cashbook for a range: opening balance, every move with its running balance, and per-day totals. */
export async function cashbook(ctx: Ctx, from: string, to: string, branchId: string | null) {
  const scope = { branchId: ctx.branchId ?? branchId };
  const all = await allMoves(ctx, scope, dayEnd(to));
  const openingCash = scope.branchId ? 0 : Number(ctx.business.cashOpeningPaise);
  const before = all.filter((m) => m.day < from);
  const opening = openingCash + before.reduce((s, m) => s + (m.direction === "IN" ? m.amountPaise : -m.amountPaise), 0);
  const inRange = all.filter((m) => m.day >= from && m.day <= to);
  const rows = cashRunning(opening, inRange);

  const closes = await db.dayClose.findMany({ where: { businessId: ctx.business.id, branchKey: scope.branchId ?? "ALL", date: { gte: from, lte: to } } });
  const closeBy = new Map(closes.map((c) => [c.date, c]));
  const days: CashDay[] = [];
  let run = opening;
  const dates = [...new Set(inRange.map((m) => m.day).concat(closes.map((c) => c.date)))].sort();
  for (const date of dates) {
    const dm = inRange.filter((m) => m.day === date);
    const inn = dm.filter((m) => m.direction === "IN").reduce((s, m) => s + m.amountPaise, 0);
    const out = dm.filter((m) => m.direction === "OUT").reduce((s, m) => s + m.amountPaise, 0);
    const c = closeBy.get(date);
    days.push({ date, opening: run, in: inn, out, closing: run + inn - out, close: c ? { counted: Number(c.countedPaise), difference: Number(c.differencePaise), note: c.note } : null });
    run += inn - out;
  }
  return { opening, closing: run, rows, days, scopeKey: scope.branchId ?? "ALL" };
}

/** Cash expected in hand at the end of a day. */
export async function expectedCash(ctx: Ctx, date: string, branchId: string | null): Promise<number> {
  const scope = { branchId: ctx.branchId ?? branchId };
  const all = await allMoves(ctx, scope, dayEnd(date));
  return (scope.branchId ? 0 : Number(ctx.business.cashOpeningPaise)) + all.reduce((s, m) => s + (m.direction === "IN" ? m.amountPaise : -m.amountPaise), 0);
}
