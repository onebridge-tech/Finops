import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { isLowStock, stockLevel } from "./rules";
import { sendToOwner } from "./messaging/send";
import type { Channel } from "./reminder-rule";

type Tx = Prisma.TransactionClient;

export type StockMove = {
  businessId: string;
  branchId: string | null;
  itemId: string | null | undefined;
  qtyMilli: number; // signed: negative takes stock out
  reason: "INVOICE" | "PURCHASE" | "RETURN" | "ADJUSTMENT" | "OPENING" | "CANCEL";
  refType?: string;
  refId?: string;
  note?: string;
  userId?: string | null;
};

/** Records a stock movement, but only for items that track stock (CI-04). Returns whether one was written. */
export async function applyStock(tx: Tx, m: StockMove): Promise<boolean> {
  if (!m.itemId || m.qtyMilli === 0) return false;
  const item = await tx.item.findFirst({ where: { id: m.itemId, businessId: m.businessId }, select: { trackStock: true } });
  if (!item?.trackStock) return false;
  await tx.stockMovement.create({
    data: {
      businessId: m.businessId, branchId: m.branchId, itemId: m.itemId, qtyMilli: m.qtyMilli, reason: m.reason,
      refType: m.refType ?? null, refId: m.refId ?? null, note: m.note ?? null, createdById: m.userId ?? null,
    },
  });
  return true;
}

export async function levelOf(businessId: string, itemId: string): Promise<number> {
  const r = await db.stockMovement.aggregate({ where: { businessId, itemId }, _sum: { qtyMilli: true } });
  return stockLevel([{ qtyMilli: r._sum.qtyMilli ?? 0 }]);
}

/**
 * After stock moves, alert the owner once when an item falls to its reorder
 * level, and re-arm the alert when it's back above (CI-04).
 */
export async function checkLowStock(businessId: string, itemIds: (string | null | undefined)[]) {
  const ids = [...new Set(itemIds.filter((x): x is string => !!x))];
  if (ids.length === 0) return;
  const business = await db.business.findUnique({ where: { id: businessId } });
  const items = await db.item.findMany({ where: { id: { in: ids }, businessId, trackStock: true, reorderLevelMilli: { not: null } } });
  const owner = await db.membership.findFirst({ where: { businessId, role: "OWNER" }, orderBy: { createdAt: "asc" }, include: { user: true } });
  if (!business || !owner) return;
  const fresh: string[] = [];
  for (const it of items) {
    const level = await levelOf(businessId, it.id);
    const low = isLowStock(level, it.reorderLevelMilli);
    if (low && !it.lowStockAlertedAt) {
      await db.item.update({ where: { id: it.id }, data: { lowStockAlertedAt: new Date() } });
      fresh.push(`${it.variantName ? `${it.name} — ${it.variantName}` : it.name}: ${level / 1000} ${it.unit} left (reorder at ${it.reorderLevelMilli! / 1000})`);
    } else if (!low && it.lowStockAlertedAt) {
      await db.item.update({ where: { id: it.id }, data: { lowStockAlertedAt: null } });
    }
  }
  if (fresh.length) {
    await sendToOwner({
      business, to: { phone: owner.user.phone, email: business.email }, channel: business.reminderChannel as Channel, kind: "ALERT",
      subject: `Low stock · ${business.name}`, body: `Low stock at ${business.name}:\n${fresh.join("\n")}`, userId: owner.userId,
    }).catch(() => undefined);
  }
}
