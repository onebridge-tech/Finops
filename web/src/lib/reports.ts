import "server-only";
import { db } from "./db";
import { docWhere, partyWhere, type Ctx } from "./auth";
import { collections, partiesWithBalance } from "./queries";
import { voucherType } from "./accounting";
import { STATES } from "./gstin";
import { changePct, monthKey, rangeDates, type Period } from "./period";
import { istDay } from "./ledger";

// ── Result shape shared by every report, the report page and the exports ─────

export type Col = { key: string; label: string; money?: boolean; right?: boolean; pct?: boolean };
export type Row = { [key: string]: string | number | null | undefined; href?: string };
export type ReportResult = { title: string; note?: string; columns: Col[]; rows: Row[]; totals?: Row };

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const money = (key: string, label: string): Col => ({ key, label, money: true, right: true });

async function names(ctx: Ctx) {
  const [members, branches] = await Promise.all([
    db.membership.findMany({ where: { businessId: ctx.business.id }, include: { user: true } }),
    db.branch.findMany({ where: { businessId: ctx.business.id } }),
  ]);
  const user = new Map(members.map((m) => [m.userId, m.user.name ?? `+${m.user.phone}`]));
  const branch = new Map(branches.map((b) => [b.id, b.name]));
  return {
    user: (id: string | null | undefined) => (id ? (user.get(id) ?? "Former member") : "Unassigned"),
    branch: (id: string | null | undefined) => (id ? (branch.get(id) ?? "Unknown branch") : "All / shared"),
    users: [...user.entries()].map(([id, name]) => ({ id, name })),
    branches: [...branch.entries()].map(([id, name]) => ({ id, name })),
  };
}

// ── Sale lines: invoices, less credit notes, plus debit notes ────────────────

type SaleLine = {
  date: Date; partyId: string; placeOfSupply: string; branchId: string | null; repId: string | null;
  itemId: string | null; description: string; category: string | null;
  taxable: number; cost: number | null; qtyMilli: number; docs: number;
};

async function saleLines(ctx: Ctx, from: string, to: string): Promise<SaleLine[]> {
  const { gte, lte } = rangeDates(from, to);
  const branch = ctx.branchId ? { branchId: ctx.branchId } : {};
  const [invoices, notes, items] = await Promise.all([
    db.invoice.findMany({ where: { ...docWhere(ctx), status: "ISSUED", date: { gte, lte } }, include: { lines: true } }),
    db.note.findMany({ where: { businessId: ctx.business.id, ...branch, status: "ISSUED", date: { gte, lte } }, include: { lines: true } }),
    db.item.findMany({ where: { businessId: ctx.business.id }, select: { id: true, category: true, purchasePricePaise: true, name: true, variantName: true, parentId: true } }),
  ]);
  const item = new Map(items.map((i) => [i.id, i]));
  const out: SaleLine[] = [];
  const push = (sign: 1 | -1, doc: { date: Date; partyId: string; placeOfSupply: string; branchId: string | null; createdById: string | null }, l: { itemId: string | null; description: string; qtyMilli: number; taxablePaise: bigint }, first: boolean) => {
    const it = l.itemId ? item.get(l.itemId) : undefined;
    const buy = it?.purchasePricePaise;
    out.push({
      date: doc.date, partyId: doc.partyId, placeOfSupply: doc.placeOfSupply, branchId: doc.branchId, repId: doc.createdById,
      itemId: l.itemId, description: l.description, category: it?.category ?? null,
      taxable: sign * Number(l.taxablePaise),
      cost: buy === null || buy === undefined ? null : sign * Math.round((Number(buy) * l.qtyMilli) / 1000),
      qtyMilli: sign * l.qtyMilli, docs: first ? sign : 0,
    });
  };
  for (const i of invoices) i.lines.forEach((l, n) => push(1, i, l, n === 0));
  for (const n of notes) n.lines.forEach((l, k) => push(n.kind === "CREDIT" ? -1 : 1, n, l, k === 0));
  return out;
}

function groupSum(lines: SaleLine[], key: (l: SaleLine) => string) {
  const m = new Map<string, { sales: number; cost: number; costKnown: boolean; docs: number; qty: number }>();
  for (const l of lines) {
    const k = key(l);
    const g = m.get(k) ?? { sales: 0, cost: 0, costKnown: true, docs: 0, qty: 0 };
    g.sales += l.taxable;
    g.docs += l.docs;
    g.qty += l.qtyMilli;
    if (l.cost === null) g.costKnown = false; else g.cost += l.cost;
    m.set(k, g);
  }
  return m;
}

// ── CP-06 Outstanding ageing ─────────────────────────────────────────────────

export async function ageingReport(ctx: Ctx, by: "party" | "rep" | "branch", filter: { rep?: string; branch?: string } = {}): Promise<ReportResult> {
  const [rows, n] = await Promise.all([collections(ctx), names(ctx)]);
  const scoped = rows.filter((p) => (!filter.rep || (filter.rep === "none" ? !p.ownerId : p.ownerId === filter.rep)) && (!filter.branch || (filter.branch === "none" ? !p.branchId : p.branchId === filter.branch)));
  type Acc = { key: string; label: string; href?: string; notDue: number; b1: number; b2: number; b3: number; b4: number };
  const acc = new Map<string, Acc>();
  for (const p of scoped) {
    const key = by === "party" ? p.id : by === "rep" ? (p.ownerId ?? "none") : (p.branchId ?? "none");
    const label = by === "party" ? p.name : by === "rep" ? n.user(p.ownerId) : n.branch(p.branchId);
    const href = by === "party" ? `/parties/${p.id}` : `/reports/ageing?by=party&${by === "rep" ? "rep" : "branch"}=${key}`;
    const a = acc.get(key) ?? { key, label, href, notDue: 0, b1: 0, b2: 0, b3: 0, b4: 0 };
    a.notDue += p.balance - p.overdue;
    a.b1 += p.ageing["0-30"]; a.b2 += p.ageing["31-60"]; a.b3 += p.ageing["61-90"]; a.b4 += p.ageing["90+"];
    acc.set(key, a);
  }
  const out = [...acc.values()].map((a) => ({ name: a.label, href: a.href, notDue: a.notDue, b1: a.b1, b2: a.b2, b3: a.b3, b4: a.b4, total: a.notDue + a.b1 + a.b2 + a.b3 + a.b4 }))
    .sort((x, y) => y.b1 + y.b2 + y.b3 + y.b4 - (x.b1 + x.b2 + x.b3 + x.b4));
  const t = (k: "notDue" | "b1" | "b2" | "b3" | "b4" | "total") => sum(out.map((r) => r[k]));
  return {
    title: "Outstanding ageing",
    note: "Receivables by how many days past due. Open a row to drill down to the party and its bills.",
    columns: [{ key: "name", label: by === "party" ? "Party" : by === "rep" ? "Rep" : "Branch" }, money("notDue", "Not yet due"), money("b1", "0–30 days"), money("b2", "31–60"), money("b3", "61–90"), money("b4", "90+"), money("total", "Total")],
    rows: out,
    totals: { name: "Total", notDue: t("notDue"), b1: t("b1"), b2: t("b2"), b3: t("b3"), b4: t("b4"), total: t("total") },
  };
}

// ── IR-02 Daybook ────────────────────────────────────────────────────────────

export const DAYBOOK_TYPES = ["Sales", "Sales (credit)", "Receipt", "Receipt (cash)", "Receipt (bank)", "Payment", "Purchase", "Opening balance", "Journal (reversal)", "Expense", "Cash adjustment", "Quotation", "Order", "Credit note", "Debit note"] as const;

export async function daybook(ctx: Ctx, p: Period, f: { type?: string; user?: string; branch?: string }): Promise<ReportResult> {
  const { gte, lte } = rangeDates(p.from, p.to);
  const branch = f.branch ? { branchId: f.branch === "none" ? null : f.branch } : ctx.branchId ? { branchId: ctx.branchId } : {};
  const [entries, expenses, adj, quotes, orders, parties, n] = await Promise.all([
    db.ledgerEntry.findMany({ where: { businessId: ctx.business.id, party: partyWhere(ctx), ...branch, date: { gte, lte }, ...(f.user ? { createdById: f.user } : {}) }, orderBy: [{ date: "asc" }, { createdAt: "asc" }], take: 3000 }),
    db.expense.findMany({ where: { businessId: ctx.business.id, ...branch, date: { gte, lte }, voidedAt: null, ...(f.user ? { createdById: f.user } : {}) } }),
    db.cashAdjustment.findMany({ where: { businessId: ctx.business.id, ...branch, date: { gte, lte }, voidedAt: null, ...(f.user ? { createdById: f.user } : {}) } }),
    db.quote.findMany({ where: { ...docWhere(ctx), date: { gte, lte }, ...(f.user ? { createdById: f.user } : {}) } }),
    db.order.findMany({ where: { businessId: ctx.business.id, ...branch, date: { gte, lte }, status: { not: "CANCELLED" }, ...(f.user ? { createdById: f.user } : {}) } }),
    partiesWithBalance(ctx, { includeArchived: true }),
    names(ctx),
  ]);
  const party = new Map(parties.map((x) => [x.id, x]));
  type R = { at: Date; date: string; type: string; party: string; details: string; by: string; branch: string; debit: number | null; credit: number | null; href?: string };
  const rows: R[] = [];
  for (const e of entries) {
    const pr = party.get(e.partyId);
    rows.push({
      at: e.createdAt, date: istDay(e.date), type: voucherType(e, pr?.type ?? "CUSTOMER"), party: pr?.name ?? "—", details: e.note ?? "", by: n.user(e.createdById), branch: n.branch(e.branchId),
      debit: e.direction === "GAVE" ? Number(e.amountPaise) : null, credit: e.direction === "GOT" ? Number(e.amountPaise) : null, href: `/parties/${e.partyId}`,
    });
  }
  for (const x of expenses) rows.push({ at: x.createdAt, date: istDay(x.date), type: "Expense", party: x.vendorId ? (party.get(x.vendorId)?.name ?? "—") : "—", details: `${x.category}${x.note ? " · " + x.note : ""}`, by: n.user(x.createdById), branch: n.branch(x.branchId), debit: Number(x.amountPaise), credit: null, href: "/expenses" });
  for (const x of adj) rows.push({ at: x.createdAt, date: istDay(x.date), type: "Cash adjustment", party: "—", details: x.note, by: n.user(x.createdById), branch: n.branch(x.branchId), debit: x.direction === "OUT" ? Number(x.amountPaise) : null, credit: x.direction === "IN" ? Number(x.amountPaise) : null, href: "/cashbook" });
  for (const x of quotes) rows.push({ at: x.createdAt, date: istDay(x.date), type: "Quotation", party: party.get(x.partyId)?.name ?? "—", details: `${x.number} · ${x.status.toLowerCase()}`, by: n.user(x.createdById), branch: n.branch(x.branchId), debit: null, credit: null, href: `/quotes/${x.id}` });
  for (const x of orders) rows.push({ at: x.createdAt, date: istDay(x.date), type: "Order", party: party.get(x.partyId)?.name ?? "—", details: `${x.number} · ${x.kind === "PURCHASE" ? "purchase" : "sales"} · ${x.status.toLowerCase()}`, by: n.user(x.createdById), branch: n.branch(x.branchId), debit: null, credit: null, href: `/orders/${x.id}` });

  const shown = rows.filter((r) => !f.type || r.type === f.type).sort((a, b) => (a.date === b.date ? a.at.getTime() - b.at.getTime() : a.date < b.date ? -1 : 1));
  return {
    title: "Daybook",
    note: shown.length >= 3000 ? "Showing the first 3,000 entries; narrow the period to see the rest." : "Every entry and document in the period. Debit = party owes more / money out; credit = payment or goods in.",
    columns: [{ key: "date", label: "Date" }, { key: "type", label: "Type" }, { key: "party", label: "Party" }, { key: "details", label: "Details" }, { key: "by", label: "By" }, { key: "branch", label: "Branch" }, money("debit", "Debit"), money("credit", "Credit")],
    rows: shown.map((r) => { const { at, ...rest } = r; void at; return rest; }),
    totals: { date: "Total", debit: sum(shown.map((r) => r.debit ?? 0)), credit: sum(shown.map((r) => r.credit ?? 0)) },
  };
}

export async function daybookFilters(ctx: Ctx) {
  const n = await names(ctx);
  return { users: n.users, branches: n.branches };
}

// ── IR-03 Top N ──────────────────────────────────────────────────────────────

export type TopDim = "customers" | "items" | "suppliers" | "reps";

export async function topReport(ctx: Ctx, p: Period, dim: TopDim, metric: "value" | "margin", n: number): Promise<ReportResult> {
  const names_ = await names(ctx);
  const label = { customers: "Customer", items: "Item", suppliers: "Supplier", reps: "Rep" }[dim];
  const title = `Top ${n} ${dim} by ${metric}`;
  if (dim === "suppliers") {
    // Purchases from a supplier: goods received (credit entries with no payment mode) plus expenses booked to them.
    const { gte, lte } = rangeDates(p.from, p.to);
    const [entries, exp, parties] = await Promise.all([
      db.ledgerEntry.findMany({ where: { businessId: ctx.business.id, party: { AND: [partyWhere(ctx), { type: { in: ["SUPPLIER", "BOTH"] } }] }, direction: "GOT", paymentMode: null, source: "MANUAL", date: { gte, lte } } }),
      db.expense.findMany({ where: { businessId: ctx.business.id, vendorId: { not: null }, voidedAt: null, date: { gte, lte } } }),
      partiesWithBalance(ctx, { where: { type: { in: ["SUPPLIER", "BOTH"] } }, includeArchived: true }),
    ]);
    const pm = new Map(parties.map((x) => [x.id, x]));
    const tot = new Map<string, number>();
    for (const e of entries.filter((x) => pm.has(x.partyId))) tot.set(e.partyId, (tot.get(e.partyId) ?? 0) + Number(e.amountPaise));
    for (const x of exp.filter((x) => x.vendorId && pm.has(x.vendorId))) tot.set(x.vendorId!, (tot.get(x.vendorId!) ?? 0) + Number(x.amountPaise));
    const rows = [...tot.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([id, v], i) => ({ rank: i + 1, name: pm.get(id)!.name, value: v, owed: Math.max(0, -pm.get(id)!.balance), href: `/parties/${id}` }));
    return { title, note: metric === "margin" ? "Margin doesn’t apply to suppliers; showing purchase value." : undefined, columns: [{ key: "rank", label: "#" }, { key: "name", label: label }, money("value", "Purchases"), money("owed", "You owe now")], rows };
  }
  const lines = await saleLines(ctx, p.from, p.to);
  const parties = dim === "customers" ? await partiesWithBalance(ctx, { includeArchived: true }) : [];
  const pm = new Map(parties.map((x) => [x.id, x]));
  const g = groupSum(lines, (l) => (dim === "customers" ? l.partyId : dim === "items" ? (l.itemId ?? `d:${l.description}`) : (l.repId ?? "none")));
  let itemName = new Map<string, string>();
  if (dim === "items") {
    const items = await db.item.findMany({ where: { businessId: ctx.business.id }, select: { id: true, name: true, variantName: true } });
    itemName = new Map(items.map((i) => [i.id, i.variantName ? `${i.name} — ${i.variantName}` : i.name]));
  }
  const nameOf = (k: string) => (dim === "customers" ? (pm.get(k)?.name ?? "—") : dim === "items" ? (k.startsWith("d:") ? k.slice(2) : (itemName.get(k) ?? "—")) : names_.user(k === "none" ? null : k));
  const value = (x: { sales: number; cost: number; costKnown: boolean }) => (metric === "margin" ? (x.costKnown ? x.sales - x.cost : null) : x.sales);
  const ranked = [...g.entries()].map(([k, x]) => ({ k, x, v: value(x) })).filter((r) => r.v !== null).sort((a, b) => (b.v ?? 0) - (a.v ?? 0)).slice(0, n);
  const unknown = [...g.values()].filter((x) => !x.costKnown).length;
  return {
    title,
    note: metric === "margin" ? `Margin = sales − purchase price × quantity.${unknown ? ` ${unknown} row(s) left out because an item has no purchase price.` : ""}` : "Sales are taxable value, less credit notes.",
    columns: [{ key: "rank", label: "#" }, { key: "name", label }, money("value", metric === "margin" ? "Margin" : "Sales"), ...(metric === "value" ? [money("margin", "Margin")] : []), { key: "docs", label: "Invoices", right: true }],
    rows: ranked.map((r, i) => ({ rank: i + 1, name: nameOf(r.k), value: r.v, margin: r.x.costKnown ? r.x.sales - r.x.cost : null, docs: r.x.docs, href: dim === "customers" ? `/parties/${r.k}` : dim === "items" && !r.k.startsWith("d:") ? `/items/${r.k}` : undefined })),
  };
}

// ── IR-05 Sales analysis ─────────────────────────────────────────────────────

export type SalesBy = "month" | "item" | "category" | "location" | "rep" | "branch" | "customer";

export async function salesAnalysis(ctx: Ctx, p: Period, by: SalesBy): Promise<ReportResult> {
  const [now, prev, n] = await Promise.all([saleLines(ctx, p.from, p.to), saleLines(ctx, p.prev.from, p.prev.to), names(ctx)]);
  const itemRows = by === "item" ? await db.item.findMany({ where: { businessId: ctx.business.id }, select: { id: true, name: true, variantName: true } }) : [];
  const itemName = new Map(itemRows.map((i) => [i.id, i.variantName ? `${i.name} — ${i.variantName}` : i.name]));
  const parties = by === "customer" ? await partiesWithBalance(ctx, { includeArchived: true }) : [];
  const pm = new Map(parties.map((x) => [x.id, x.name]));
  const key = (l: SaleLine) =>
    by === "month" ? monthKey(l.date) : by === "item" ? (l.itemId ?? `d:${l.description}`) : by === "category" ? (l.category ?? "Uncategorised")
    : by === "location" ? l.placeOfSupply : by === "rep" ? (l.repId ?? "none") : by === "branch" ? (l.branchId ?? "none") : l.partyId;
  const label = (k: string) =>
    by === "month" ? k : by === "item" ? (k.startsWith("d:") ? k.slice(2) : (itemName.get(k) ?? "—")) : by === "category" ? k
    : by === "location" ? (STATES[k] ?? k) : by === "rep" ? n.user(k === "none" ? null : k) : by === "branch" ? n.branch(k === "none" ? null : k) : (pm.get(k) ?? "—");
  const a = groupSum(now, key);
  const b = groupSum(prev, key);
  const total = sum([...a.values()].map((x) => x.sales));
  const keys = by === "month" ? [...new Set([...a.keys()])].sort() : [...a.keys()].sort((x, y) => (b.get(y)?.sales ?? 0) * 0 + a.get(y)!.sales - a.get(x)!.sales);
  const rows = keys.map((k) => {
    const x = a.get(k)!;
    const was = b.get(k)?.sales ?? 0;
    return { name: label(k), sales: x.sales, share: total ? Math.round((x.sales / total) * 1000) / 10 : 0, margin: x.costKnown ? x.sales - x.cost : null, prev: was, change: changePct(x.sales, was) };
  });
  const prevTotal = sum([...b.values()].map((x) => x.sales));
  return {
    title: `Sales by ${by}`,
    note: `Taxable value, less credit notes. Compared with ${p.prev.from} to ${p.prev.to}.`,
    columns: [{ key: "name", label: by === "location" ? "State" : by[0].toUpperCase() + by.slice(1) }, money("sales", "Sales"), { key: "share", label: "Share %", right: true, pct: true }, money("margin", "Margin"), money("prev", "Previous period"), { key: "change", label: "Change %", right: true, pct: true }],
    rows,
    totals: { name: "Total", sales: total, share: 100, prev: prevTotal, change: changePct(total, prevTotal) },
  };
}

// ── IR-06 Expense analysis ───────────────────────────────────────────────────

export async function expenseAnalysis(ctx: Ctx, p: Period, by: "category" | "branch" | "month" | "entries", cat?: string): Promise<ReportResult> {
  const { gte, lte } = rangeDates(p.from, p.to);
  const branch = ctx.branchId ? { branchId: ctx.branchId } : {};
  const [now, prev, n] = await Promise.all([
    db.expense.findMany({ where: { businessId: ctx.business.id, ...branch, voidedAt: null, date: { gte, lte }, ...(cat ? { category: cat } : {}) }, orderBy: { date: "desc" } }),
    db.expense.findMany({ where: { businessId: ctx.business.id, ...branch, voidedAt: null, date: rangeDates(p.prev.from, p.prev.to), ...(cat ? { category: cat } : {}) } }),
    names(ctx),
  ]);
  if (by === "entries") {
    return {
      title: cat ? `Expenses: ${cat}` : "Expenses",
      columns: [{ key: "date", label: "Date" }, { key: "category", label: "Category" }, { key: "note", label: "Note" }, { key: "mode", label: "Paid by" }, { key: "branch", label: "Branch" }, money("amount", "Amount")],
      rows: now.map((x) => ({ date: istDay(x.date), category: x.category, note: x.note ?? "", mode: x.paymentMode, branch: n.branch(x.branchId), amount: Number(x.amountPaise), href: "/expenses" })),
      totals: { date: "Total", amount: sum(now.map((x) => Number(x.amountPaise))) },
    };
  }
  const key = (x: { category: string; branchId: string | null; date: Date }) => (by === "category" ? x.category : by === "branch" ? (x.branchId ?? "none") : monthKey(x.date));
  const label = (k: string) => (by === "branch" ? n.branch(k === "none" ? null : k) : k);
  const agg = (xs: typeof now) => { const m = new Map<string, { total: number; count: number }>(); for (const x of xs) { const g = m.get(key(x)) ?? { total: 0, count: 0 }; g.total += Number(x.amountPaise); g.count++; m.set(key(x), g); } return m; };
  const a = agg(now);
  const b = agg(prev);
  const total = sum([...a.values()].map((x) => x.total));
  const keys = by === "month" ? [...a.keys()].sort() : [...a.keys()].sort((x, y) => a.get(y)!.total - a.get(x)!.total);
  return {
    title: `Expenses by ${by}`,
    note: `Click a category to see its entries. Compared with ${p.prev.from} to ${p.prev.to}.`,
    columns: [{ key: "name", label: by[0].toUpperCase() + by.slice(1) }, { key: "count", label: "Entries", right: true }, money("amount", "Amount"), { key: "share", label: "Share %", right: true, pct: true }, money("prev", "Previous period"), { key: "change", label: "Change %", right: true, pct: true }],
    rows: keys.map((k) => ({
      name: label(k), count: a.get(k)!.count, amount: a.get(k)!.total, share: total ? Math.round((a.get(k)!.total / total) * 1000) / 10 : 0, prev: b.get(k)?.total ?? 0, change: changePct(a.get(k)!.total, b.get(k)?.total ?? 0),
      href: by === "category" ? `/reports/expenses?by=entries&cat=${encodeURIComponent(k)}&period=${p.preset}&from=${p.from}&to=${p.to}` : undefined,
    })),
    totals: { name: "Total", count: sum([...a.values()].map((x) => x.count)), amount: total, share: 100, prev: sum([...b.values()].map((x) => x.total)), change: changePct(total, sum([...b.values()].map((x) => x.total))) },
  };
}

// ── FS-09 Lead source and rep attribution ────────────────────────────────────

export async function sourceReport(ctx: Ctx, p: Period, by: "source" | "rep"): Promise<ReportResult> {
  const { gte, lte } = rangeDates(p.from, p.to);
  const [parties, lines, got, n] = await Promise.all([
    partiesWithBalance(ctx, { includeArchived: true }),
    saleLines(ctx, p.from, p.to),
    db.ledgerEntry.findMany({ where: { businessId: ctx.business.id, party: partyWhere(ctx), direction: "GOT", paymentMode: { not: null }, date: { gte, lte } }, select: { partyId: true, amountPaise: true } }),
    names(ctx),
  ]);
  const key = (x: { source: string | null; ownerId: string | null }) => (by === "source" ? (x.source?.trim() || "Unknown") : (x.ownerId ?? "none"));
  const label = (k: string) => (by === "source" ? k : n.user(k === "none" ? null : k));
  const pm = new Map(parties.map((x) => [x.id, x]));
  type G = { parties: number; fresh: number; invoiced: number; collected: number; outstanding: number };
  const g = new Map<string, G>();
  const get = (k: string) => g.get(k) ?? (g.set(k, { parties: 0, fresh: 0, invoiced: 0, collected: 0, outstanding: 0 }), g.get(k)!);
  for (const x of parties) {
    const a = get(key(x));
    a.parties++;
    if (x.createdAt >= gte && x.createdAt <= lte) a.fresh++;
    a.outstanding += Math.max(0, x.balance);
  }
  for (const l of lines) { const x = pm.get(l.partyId); if (x) get(key(x)).invoiced += l.taxable; }
  for (const e of got) { const x = pm.get(e.partyId); if (x) get(key(x)).collected += Number(e.amountPaise); }
  const rows = [...g.entries()].sort((a, b) => b[1].invoiced - a[1].invoiced).map(([k, v]) => ({ name: label(k), parties: v.parties, fresh: v.fresh, invoiced: v.invoiced, collected: v.collected, outstanding: v.outstanding }));
  return {
    title: by === "source" ? "Lead source roll-up" : "Rep roll-up",
    note: "Invoiced and collected are for the period; parties and outstanding are as of today.",
    columns: [{ key: "name", label: by === "source" ? "Source" : "Rep" }, { key: "parties", label: "Parties", right: true }, { key: "fresh", label: "New in period", right: true }, money("invoiced", "Invoiced"), money("collected", "Collected"), money("outstanding", "Outstanding")],
    rows,
    totals: { name: "Total", parties: sum(rows.map((r) => r.parties)), fresh: sum(rows.map((r) => r.fresh)), invoiced: sum(rows.map((r) => r.invoiced)), collected: sum(rows.map((r) => r.collected)), outstanding: sum(rows.map((r) => r.outstanding)) },
  };
}
