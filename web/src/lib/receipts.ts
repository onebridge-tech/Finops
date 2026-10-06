import "server-only";
import type { Prisma } from "@prisma/client";
import { newShareToken } from "./session";

/** Reserves the next receipt number and issues a receipt for a money-in entry (CP-11). */
export async function issueReceipt(
  tx: Prisma.TransactionClient,
  businessId: string,
  e: { id: string; partyId: string; branchId: string | null; amountPaise: bigint; date: Date; paymentMode: string | null },
) {
  const b = await tx.business.update({ where: { id: businessId }, data: { nextReceiptNo: { increment: 1 } } });
  return tx.receipt.create({
    data: {
      businessId, partyId: e.partyId, branchId: e.branchId, entryId: e.id, number: `${b.receiptPrefix}${b.nextReceiptNo - 1}`,
      amountPaise: e.amountPaise, date: e.date, mode: e.paymentMode, shareToken: newShareToken(),
    },
  });
}
