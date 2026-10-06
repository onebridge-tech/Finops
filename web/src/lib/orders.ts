import "server-only";
import type { Prisma } from "@prisma/client";
import { audit } from "./audit";
import { newShareToken } from "./session";
import { isInterState } from "./gst";
import { priceLines, type LineRow } from "./doc-core";

type Tx = Prisma.TransactionClient;

export type NewOrder = {
  businessId: string; branchId: string | null; kind: "SALES" | "PURCHASE"; partyId: string; date: Date; expectedDate: Date | null;
  placeOfSupply: string; sellerStateCode: string; notes: string | null; lines: LineRow[];
  status?: "REQUEST" | "OPEN"; source?: "MANUAL" | "CATALOGUE" | "VISIT" | "QUOTE"; quoteId?: string; visitId?: string; userId: string | null;
};

/** Creates an order with its lines and the next number in the sales or purchase series (BD-02). */
export async function createOrderRecord(tx: Tx, o: NewOrder) {
  const b = await tx.business.update({
    where: { id: o.businessId },
    data: o.kind === "SALES" ? { nextOrderNo: { increment: 1 } } : { nextPoNo: { increment: 1 } },
  });
  const number = o.kind === "SALES" ? `${b.orderPrefix}${b.nextOrderNo - 1}` : `${b.poPrefix}${b.nextPoNo - 1}`;
  const priced = priceLines(o.lines, isInterState(o.sellerStateCode, o.placeOfSupply));
  const order = await tx.order.create({
    data: {
      businessId: o.businessId, branchId: o.branchId, kind: o.kind, number, partyId: o.partyId, date: o.date, expectedDate: o.expectedDate,
      status: o.status ?? "OPEN", source: o.source ?? "MANUAL", quoteId: o.quoteId ?? null, visitId: o.visitId ?? null,
      placeOfSupply: o.placeOfSupply, ...priced.header, notes: o.notes, shareToken: newShareToken(), createdById: o.userId,
      lines: { create: priced.rows },
    },
  });
  await audit(tx, { businessId: o.businessId, actorId: o.userId ?? "system", action: "create", entity: "Order", entityId: order.id, data: { number, kind: o.kind, total: priced.total, source: o.source ?? "MANUAL" } });
  return order;
}
