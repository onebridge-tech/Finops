import "server-only";
import { db } from "./db";
import { docWhere, type Ctx } from "./auth";
import { istDay } from "./ledger";
import { kindOf } from "./categorize";
import { partiesWithBalance } from "./queries";

// Numbers for "how much did I spend and earn": from the bank statement (money in and out), and from the
// shop's own bills and expenses (profit and loss). All amounts are paise.

const DAY = 86_400_000;

/** "2026-10" → the first and last day, and the instants that bound it in IST. */
export function monthBounds(ym: string) {
  const [y, m] = ym.split("-").map(Number) as [number, number];
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const from = `${ym}-01`;
  const to = `${ym}-${String(last).padStart(2, "0")}`;
  return { from, to, days: last, gte: new Date(`${from}T00:00:00+05:30`), lte: new Date(`${to}T23:59:59.999+05:30`) };
}

export const isMonth = (v: unknown): v is string => typeof v === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);

export function shiftMonth(ym: string, by: number): string {
  const [y, m] = ym.split("-").map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export const monthLabel = (ym: string) => new Date(`${ym}-15T12:00:00+05:30`).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "Asia/Kolkata" });

// ── From the statement ──────────────────────────────────────────────────────

export type CategoryTotal = { category: string; paise: number; count: number };
export type Payee = { name: string; paise: number; count: number };

export async function monthsWithStatements(businessId: string): Promise<string[]> {
  const rows = await db.$queryRaw<{ m: string }[]>`SELECT DISTINCT to_char("date" AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM') AS m FROM "BankTxn" WHERE "businessId" = ${businessId} ORDER BY 1 DESC`;
  return rows.map((r) => r.m);
}

export async function moneySummary(businessId: string, ym: string) {
  const { gte, lte, from, days } = monthBounds(ym);
  const txns = await db.bankTxn.findMany({ where: { businessId, date: { gte, lte } }, orderBy: [{ date: "asc" }, { createdAt: "asc" }] });
  let income = 0, spend = 0, transferIn = 0, transferOut = 0;
  const cat = new Map<string, CategoryTotal>();
  const payees = { in: new Map<string, Payee>(), out: new Map<string, Payee>() };
  const daily = Array.from({ length: days }, (_, i) => ({ day: istDay(new Date(new Date(`${from}T12:00:00+05:30`).getTime() + i * DAY)), in: 0, out: 0 }));
  for (const t of txns) {
    const p = Number(t.amountPaise);
    const kind = kindOf(t.category);
    if (t.direction === "IN") { if (kind === "income") income += p; else transferIn += p; } else if (kind === "spend") spend += p; else transferOut += p;
    const c = cat.get(t.category) ?? { category: t.category, paise: 0, count: 0 };
    c.paise += p; c.count++; cat.set(t.category, c);
    const d = daily[Number(istDay(t.date).slice(8, 10)) - 1];
    if (d && kind !== "transfer") d[t.direction === "IN" ? "in" : "out"] += p;
    if (t.counterparty && kind !== "transfer") {
      const m = payees[t.direction === "IN" ? "in" : "out"];
      const x = m.get(t.counterparty) ?? { name: t.counterparty, paise: 0, count: 0 };
      x.paise += p; x.count++; m.set(t.counterparty, x);
    }
  }
  const top = (m: Map<string, Payee>) => [...m.values()].sort((a, b) => b.paise - a.paise).slice(0, 6);
  const byCat = (dir: "IN" | "OUT") => [...cat.values()].filter((c) => txns.some((t) => t.category === c.category && t.direction === dir)).sort((a, b) => b.paise - a.paise);
  const first = txns.find((t) => t.balancePaise !== null);
  const lastB = [...txns].reverse().find((t) => t.balancePaise !== null);
  return {
    count: txns.length, income, spend, left: income - spend, transferIn, transferOut,
    incomeByCategory: byCat("IN"), spendByCategory: byCat("OUT"), daily, topSpend: top(payees.out), topIncome: top(payees.in),
    balance: first && lastB ? { opening: Number(first.balancePaise) + (first.direction === "IN" ? -Number(first.amountPaise) : Number(first.amountPaise)), closing: Number(lastB.balancePaise) } : null,
  };
}

// ── From the shop's own books ───────────────────────────────────────────────

export type MonthPL = {
  month: string; sales: number; returns: number; netSales: number; cogs: number; costCoverage: number; grossProfit: number;
  costBasis: "items" | "purchases" | "none"; itemCost: number; purchases: number;
  expenses: number; expenseByCategory: { category: string; paise: number }[]; netProfit: number; invoices: number;
};

export async function profitAndLoss(ctx: Ctx, ym: string): Promise<MonthPL> {
  const { gte, lte } = monthBounds(ym);
  const bid = ctx.business.id;
  const [inv, notes, lines, expenses] = await Promise.all([
    db.invoice.aggregate({ where: { ...docWhere(ctx), status: "ISSUED", date: { gte, lte } }, _sum: { taxablePaise: true }, _count: true }),
    db.note.aggregate({ where: { businessId: bid, kind: "CREDIT", status: "ISSUED", date: { gte, lte } }, _sum: { taxablePaise: true } }),
    db.invoiceLine.findMany({ where: { invoice: { ...docWhere(ctx), status: "ISSUED", date: { gte, lte } } }, select: { itemId: true, qtyMilli: true, taxablePaise: true } }),
    db.expense.findMany({ where: { businessId: bid, voidedAt: null, date: { gte, lte }, ...(ctx.branchId ? { branchId: ctx.branchId } : {}) }, select: { category: true, amountPaise: true } }),
  ]);
  const items = await db.item.findMany({ where: { businessId: bid, id: { in: [...new Set(lines.map((l) => l.itemId).filter((x): x is string => !!x))] } }, select: { id: true, purchasePricePaise: true } });
  const cost = new Map(items.filter((i) => i.purchasePricePaise !== null).map((i) => [i.id, Number(i.purchasePricePaise)]));
  let cogs = 0, known = 0, total = 0;
  for (const l of lines) {
    const t = Number(l.taxablePaise);
    total += t;
    const c = l.itemId ? cost.get(l.itemId) : undefined;
    if (c !== undefined) { cogs += Math.round((c * l.qtyMilli) / 1000); known += t; }
  }
  const sales = Number(inv._sum.taxablePaise ?? 0n);
  const returns = Number(notes._sum.taxablePaise ?? 0n);
  const by = new Map<string, number>();
  let purchases = 0;
  for (const e of expenses) {
    // Stock you paid suppliers for is what you bought, not an everyday running cost.
    if (e.category === "Stock purchases") purchases += Number(e.amountPaise);
    else by.set(e.category, (by.get(e.category) ?? 0) + Number(e.amountPaise));
  }
  const expTotal = [...by.values()].reduce((s, v) => s + v, 0);
  const netSales = sales - returns;
  const coverage = total === 0 ? 100 : Math.round((known / total) * 100);
  // Best cost: the buying price of the items sold. If most items have no buying price, fall back to what was paid for stock that month.
  const basis: MonthPL["costBasis"] = coverage >= 90 && cogs > 0 ? "items" : purchases > 0 ? "purchases" : cogs > 0 ? "items" : "none";
  const used = basis === "purchases" ? purchases : cogs;
  return {
    month: ym, sales, returns, netSales, cogs: used, costCoverage: coverage, grossProfit: netSales - used, costBasis: basis, itemCost: cogs, purchases,
    expenses: expTotal, expenseByCategory: [...by].map(([category, paise]) => ({ category, paise })).sort((a, b) => b.paise - a.paise), netProfit: netSales - used - expTotal, invoices: inv._count,
  };
}

export async function collectedThisMonth(ctx: Ctx, ym: string) {
  const { gte, lte } = monthBounds(ym);
  const rows = await db.ledgerEntry.groupBy({
    by: ["direction"], where: { businessId: ctx.business.id, date: { gte, lte }, source: { notIn: ["REVERSAL", "OPENING", "NOTE"] }, reversedBy: null, ...(ctx.branchId ? { branchId: ctx.branchId } : {}) },
    _sum: { amountPaise: true },
  });
  const sum = (d: string) => Number(rows.find((r) => r.direction === d)?._sum.amountPaise ?? 0n);
  return { received: sum("GOT"), creditGiven: sum("GAVE") };
}

export async function receivablesNow(ctx: Ctx): Promise<number> {
  const parties = await partiesWithBalance(ctx);
  return parties.filter((p) => p.balance > 0).reduce((s, p) => s + p.balance, 0);
}

export async function trend(ctx: Ctx, ym: string, months = 6): Promise<MonthPL[]> {
  const list = Array.from({ length: months }, (_, i) => shiftMonth(ym, i - (months - 1)));
  return Promise.all(list.map((m) => profitAndLoss(ctx, m)));
}
