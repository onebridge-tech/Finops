import "server-only";
import { after } from "next/server";
import { db } from "../db";
import { audit } from "../audit";
import { issueReceipt } from "../receipts";
import { openByEntry, balanceOf, istDay } from "../ledger";
import { allocationsByParty } from "../queries";
import { sendToParty, sendToOwner } from "../messaging/send";
import { formatINR } from "../money";
import { appUrl } from "../share";
import { fmtDate } from "../format";
import type { Channel } from "../reminder-rule";
import type { PaymentEvent } from "./gateway";

export type SettleResult = "PAID" | "ALREADY" | "FAILED" | "MISMATCH" | "UNKNOWN";

/**
 * Applies a gateway result to our books (CP-05). Safe to call many times for the same
 * payment: only the call that moves it out of CREATED posts anything, so a webhook that
 * arrives twice, or alongside the customer returning to our page, can't double-count.
 */
export async function settleFromGateway(ev: PaymentEvent): Promise<SettleResult> {
  const pay = await db.payment.findFirst({ where: { providerOrderId: ev.providerOrderId } });
  if (!pay) return "UNKNOWN";
  if (pay.status === "PAID") return "ALREADY";

  if (ev.status === "FAILED") {
    await db.payment.updateMany({ where: { id: pay.id, status: "CREATED" }, data: { status: "FAILED" } });
    return "FAILED";
  }
  // What the gateway says it took must cover what we asked for; otherwise leave it for a person.
  if (ev.amountPaise < Number(pay.amountPaise)) {
    await db.payment.updateMany({ where: { id: pay.id, status: "CREATED" }, data: { status: "FAILED", providerPaymentId: ev.providerPaymentId } });
    await db.$transaction((tx) => audit(tx, { businessId: pay.businessId, actorId: "gateway", action: "payment_mismatch", entity: "Payment", entityId: pay.id, data: { expected: Number(pay.amountPaise), received: ev.amountPaise } }));
    return "MISMATCH";
  }

  const business = await db.business.findUniqueOrThrow({ where: { id: pay.businessId } });
  const party = await db.party.findUniqueOrThrow({ where: { id: pay.partyId } });
  const amount = Number(pay.amountPaise);
  const invoice = pay.invoiceId ? await db.invoice.findUnique({ where: { id: pay.invoiceId } }) : null;
  const now = new Date();

  const done = await db.$transaction(async (tx) => {
    const claimed = await tx.payment.updateMany({ where: { id: pay.id, status: "CREATED" }, data: { status: "PAID", paidAt: now, providerPaymentId: ev.providerPaymentId } });
    if (claimed.count === 0) return null;
    const entry = await tx.ledgerEntry.create({
      data: {
        businessId: pay.businessId, partyId: pay.partyId, branchId: invoice?.branchId ?? party.branchId, direction: "GOT", amountPaise: BigInt(amount),
        date: new Date(`${istDay(now)}T12:00:00+05:30`), paymentMode: "UPI",
        note: `Paid online${invoice ? ` · ${invoice.number}` : ""}${ev.providerPaymentId ? ` · ref ${ev.providerPaymentId}` : ""}`, createdById: "online",
      },
    });
    const receipt = await issueReceipt(tx, pay.businessId, entry);
    // Settle the invoice that was paid, up to what is still open on it.
    if (invoice) {
      const invEntry = await tx.ledgerEntry.findFirst({ where: { businessId: pay.businessId, partyId: pay.partyId, invoiceId: invoice.id, source: "INVOICE" } });
      if (invEntry) {
        const [entries, allocs] = await Promise.all([tx.ledgerEntry.findMany({ where: { partyId: pay.partyId } }), allocationsByParty(pay.businessId, [pay.partyId])]);
        const open = openByEntry(entries.filter((e) => e.id !== entry.id), allocs.get(pay.partyId) ?? []).get(invEntry.id) ?? 0;
        const apply = Math.min(open, amount);
        if (apply > 0) await tx.allocation.create({ data: { businessId: pay.businessId, partyId: pay.partyId, receiptEntryId: entry.id, invoiceEntryId: invEntry.id, amountPaise: BigInt(apply), createdById: "online" } });
      }
    }
    await tx.payment.update({ where: { id: pay.id }, data: { entryId: entry.id } });
    await audit(tx, { businessId: pay.businessId, actorId: "gateway", action: "online_payment", entity: "Payment", entityId: pay.id, data: { amount, entryId: entry.id, provider: pay.provider, providerPaymentId: ev.providerPaymentId } });
    return { entry, receipt };
  });
  if (!done) return "ALREADY";

  after(async () => {
    const bal = balanceOf(await db.ledgerEntry.findMany({ where: { partyId: party.id } }));
    await sendToParty({
      business, party, kind: "RECEIPT", channel: business.reminderChannel as Channel, userId: null, trigger: "AUTO",
      vars: { amountPaise: amount, number: done.receipt.number, date: fmtDate(done.entry.date), balancePaise: bal, link: appUrl(`/r/${done.receipt.shareToken}`) },
    }).catch(() => undefined);
    const owner = await db.membership.findFirst({ where: { businessId: business.id, role: "OWNER" }, include: { user: true } });
    if (owner) {
      await sendToOwner({
        business, to: { phone: owner.user.phone, email: business.email }, channel: business.digestChannel as Channel, kind: "ALERT",
        subject: `Payment received · ${business.name}`, body: `${party.name} paid ${formatINR(amount)} online${invoice ? ` for ${invoice.number}` : ""}. Receipt ${done.receipt.number} sent.`, userId: owner.userId,
      }).catch(() => undefined);
    }
  });
  return "PAID";
}
