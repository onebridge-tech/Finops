import "server-only";
import { db } from "./db";
import { branchOrShared, partyWhere, type Ctx } from "./auth";
import { istDay } from "./ledger";
import { isLowStock, pendingMilli } from "./rules";
import type { ReportResult } from "./reports";

const money = (key: string, label: string) => ({ key, label, money: true, right: true });
const qty = (milli: number) => String(Math.round(milli) / 1000);

/** BD-02: what has been ordered and not yet delivered, line by line. */
export async function ordersReport(ctx: Ctx, kind: "SALES" | "PURCHASE"): Promise<ReportResult> {
  const parties = await db.party.findMany({ where: partyWhere(ctx), select: { id: true, name: true } });
  const pn = new Map(parties.map((p) => [p.id, p.name]));
  const orders = await db.order.findMany({
    where: { businessId: ctx.business.id, kind, status: { in: ["OPEN", "PARTIAL"] }, partyId: { in: [...pn.keys()] }, ...branchOrShared(ctx) },
    include: { lines: true },
    orderBy: { date: "asc" },
  });
  const rows = orders.flatMap((o) =>
    o.lines.filter((l) => pendingMilli(l) > 0).map((l) => ({
      order: o.number, party: pn.get(o.partyId) ?? "—", date: istDay(o.date), expected: o.expectedDate ? istDay(o.expectedDate) : "",
      item: l.description, ordered: qty(l.qtyMilli) + " " + l.unit, delivered: qty(l.fulfilledMilli), pending: qty(pendingMilli(l)),
      value: Math.round((Number(l.totalPaise) * pendingMilli(l)) / Math.max(l.qtyMilli, 1)), href: `/orders/${o.id}`,
    })),
  );
  return {
    title: kind === "SALES" ? "Pending sales orders" : "Pending purchase orders",
    note: "Open and part-delivered orders, one row per item still to deliver. Value includes tax.",
    columns: [{ key: "order", label: "Order" }, { key: "party", label: kind === "SALES" ? "Customer" : "Supplier" }, { key: "date", label: "Ordered" }, { key: "expected", label: "Expected" }, { key: "item", label: "Item" }, { key: "ordered", label: "Ordered qty", right: true }, { key: "delivered", label: "Delivered", right: true }, { key: "pending", label: "Pending", right: true }, money("value", "Pending value")],
    rows,
    totals: { order: "Total", value: rows.reduce((s, r) => s + r.value, 0) },
  };
}

/** Stock on hand per tracked item, with reorder levels (CI-04). */
export async function stockLevels(ctx: Ctx) {
  const [items, sums] = await Promise.all([
    db.item.findMany({ where: { businessId: ctx.business.id, archivedAt: null, trackStock: true }, orderBy: [{ name: "asc" }, { variantName: "asc" }] }),
    db.stockMovement.groupBy({ by: ["itemId"], where: { businessId: ctx.business.id, ...(ctx.branchId ? { branchId: ctx.branchId } : {}) }, _sum: { qtyMilli: true } }),
  ]);
  const level = new Map(sums.map((s) => [s.itemId, s._sum.qtyMilli ?? 0]));
  return items.map((i) => ({ item: i, level: level.get(i.id) ?? 0, low: isLowStock(level.get(i.id) ?? 0, i.reorderLevelMilli) }));
}

export async function stockReport(ctx: Ctx, lowOnly: boolean): Promise<ReportResult> {
  const all = await stockLevels(ctx);
  const rows = all.filter((r) => !lowOnly || r.low).map((r) => ({
    name: r.item.variantName ? `${r.item.name} — ${r.item.variantName}` : r.item.name,
    sku: r.item.sku ?? "", unit: r.item.unit, onHand: qty(r.level), reorder: r.item.reorderLevelMilli === null ? "" : qty(r.item.reorderLevelMilli),
    status: r.low ? "LOW" : "OK",
    value: Math.max(0, Math.round((Number(r.item.purchasePricePaise ?? r.item.pricePaise) * r.level) / 1000)), href: `/stock?item=${r.item.id}`,
  }));
  return {
    title: lowOnly ? "Low stock" : "Stock",
    note: "Value is at purchase price where known, otherwise sale price.",
    columns: [{ key: "name", label: "Item" }, { key: "sku", label: "SKU" }, { key: "unit", label: "Unit" }, { key: "onHand", label: "On hand", right: true }, { key: "reorder", label: "Reorder at", right: true }, { key: "status", label: "Status" }, money("value", "Stock value")],
    rows,
    totals: { name: "Total", value: rows.reduce((s, r) => s + r.value, 0) },
  };
}
