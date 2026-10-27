import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { removeBusinessFiles } from "./files";
import { readSite } from "./site-settings";

// Deleting an account, as the Digital Personal Data Protection Act, 2023 (s. 12) asks: the person can have their
// data erased. They ask on /account/delete; their account is closed at once and erased for good once the
// "delete within" days set in Company info have passed, so a mistake can still be undone in between.
// A shop is erased with the account only when that person was its only owner; otherwise it belongs to the others.

type Tx = Prisma.TransactionClient;

/**
 * Every table that holds a shop's rows, in an order the database accepts (rows that point at others go first).
 * The test in erase.test.ts fails when a new table with a businessId is not listed here.
 */
export const BUSINESS_TABLES: [string, (tx: Tx, businessId: string) => Promise<unknown>][] = [
  ["QuoteLine", (tx, id) => tx.quoteLine.deleteMany({ where: { quote: { businessId: id } } })],
  ["InvoiceLine", (tx, id) => tx.invoiceLine.deleteMany({ where: { invoice: { businessId: id } } })],
  ["OrderLine", (tx, id) => tx.orderLine.deleteMany({ where: { order: { businessId: id } } })],
  ["NoteLine", (tx, id) => tx.noteLine.deleteMany({ where: { note: { businessId: id } } })],
  ["PriceListItem", (tx, id) => tx.priceListItem.deleteMany({ where: { priceList: { businessId: id } } })],
  ["BeatParty", (tx, id) => tx.beatParty.deleteMany({ where: { beat: { businessId: id } } })],
  ["Receipt", (tx, id) => tx.receipt.deleteMany({ where: { businessId: id } })],
  ["ConsentEvent", (tx, id) => tx.consentEvent.deleteMany({ where: { businessId: id } })],
  ["FollowUp", (tx, id) => tx.followUp.deleteMany({ where: { businessId: id } })],
  ["Message", (tx, id) => tx.message.deleteMany({ where: { businessId: id } })],
  ["Quote", (tx, id) => tx.quote.deleteMany({ where: { businessId: id } })],
  ["Invoice", (tx, id) => tx.invoice.deleteMany({ where: { businessId: id } })],
  ["LedgerEntry", (tx, id) => tx.ledgerEntry.deleteMany({ where: { businessId: id } })],
  ["Order", (tx, id) => tx.order.deleteMany({ where: { businessId: id } })],
  ["Note", (tx, id) => tx.note.deleteMany({ where: { businessId: id } })],
  ["PriceList", (tx, id) => tx.priceList.deleteMany({ where: { businessId: id } })],
  ["Beat", (tx, id) => tx.beat.deleteMany({ where: { businessId: id } })],
  ["Item", (tx, id) => tx.item.deleteMany({ where: { businessId: id } })],
  ["Statement", (tx, id) => tx.statement.deleteMany({ where: { businessId: id } })],
  ["BankTxn", (tx, id) => tx.bankTxn.deleteMany({ where: { businessId: id } })],
  ["CategoryRule", (tx, id) => tx.categoryRule.deleteMany({ where: { businessId: id } })],
  ["MessageTemplate", (tx, id) => tx.messageTemplate.deleteMany({ where: { businessId: id } })],
  ["StoredFile", (tx, id) => tx.storedFile.deleteMany({ where: { businessId: id } })],
  ["CreditTxn", (tx, id) => tx.creditTxn.deleteMany({ where: { businessId: id } })],
  ["AuditEvent", (tx, id) => tx.auditEvent.deleteMany({ where: { businessId: id } })],
  ["Allocation", (tx, id) => tx.allocation.deleteMany({ where: { businessId: id } })],
  ["PromiseToPay", (tx, id) => tx.promiseToPay.deleteMany({ where: { businessId: id } })],
  ["Expense", (tx, id) => tx.expense.deleteMany({ where: { businessId: id } })],
  ["PurchaseBill", (tx, id) => tx.purchaseBill.deleteMany({ where: { businessId: id } })],
  ["CashSale", (tx, id) => tx.cashSale.deleteMany({ where: { businessId: id } })],
  ["NoteScan", (tx, id) => tx.noteScan.deleteMany({ where: { businessId: id } })],
  ["CashAdjustment", (tx, id) => tx.cashAdjustment.deleteMany({ where: { businessId: id } })],
  ["DayClose", (tx, id) => tx.dayClose.deleteMany({ where: { businessId: id } })],
  ["StockMovement", (tx, id) => tx.stockMovement.deleteMany({ where: { businessId: id } })],
  ["Visit", (tx, id) => tx.visit.deleteMany({ where: { businessId: id } })],
  ["Target", (tx, id) => tx.target.deleteMany({ where: { businessId: id } })],
  ["Attendance", (tx, id) => tx.attendance.deleteMany({ where: { businessId: id } })],
  ["Payment", (tx, id) => tx.payment.deleteMany({ where: { businessId: id } })],
  ["TallySync", (tx, id) => tx.tallySync.deleteMany({ where: { businessId: id } })],
  ["SharedEntry", (tx, id) => tx.sharedEntry.deleteMany({ where: { businessId: id } })],
  ["ClientOp", (tx, id) => tx.clientOp.deleteMany({ where: { businessId: id } })],
  ["Party", (tx, id) => tx.party.deleteMany({ where: { businessId: id } })],
  ["Membership", (tx, id) => tx.membership.deleteMany({ where: { businessId: id } })],
  ["Branch", (tx, id) => tx.branch.deleteMany({ where: { businessId: id } })],
  // Other people's devices that had this shop open just stop pointing at it.
  ["Session", (tx, id) => tx.session.updateMany({ where: { businessId: id }, data: { businessId: null, branchId: null } })],
];

/** Erases a shop and everything in it, files included. */
export async function eraseBusiness(businessId: string) {
  await db.$transaction(async (tx) => {
    for (const [, step] of BUSINESS_TABLES) await step(tx, businessId);
    await tx.business.delete({ where: { id: businessId } });
  }, { timeout: 120_000 });
  await removeBusinessFiles(businessId);
}

/** The shops that close with this person's account: those where nobody else is an owner. */
export async function shopsClosingWith(userId: string) {
  const mine = await db.membership.findMany({ where: { userId }, include: { business: { select: { id: true, name: true, _count: { select: { memberships: true } } } } } });
  const out: { id: string; name: string; members: number; closes: boolean }[] = [];
  for (const m of mine) {
    const otherOwners = m.role === "OWNER" ? await db.membership.count({ where: { businessId: m.businessId, role: "OWNER", userId: { not: userId } } }) : 1;
    out.push({ id: m.businessId, name: m.business.name, members: m.business._count.memberships, closes: m.role === "OWNER" && otherOwners === 0 });
  }
  return out;
}

/** When an account asked to be deleted at `requestedAt` is erased. */
export async function erasesOn(requestedAt: Date) {
  const { deleteDaysNum } = await readSite();
  return new Date(requestedAt.getTime() + deleteDaysNum * 86_400_000);
}

/**
 * Closes the account now: every other device is signed out and the shops it alone owns close. The device that asked
 * stays signed in only to see what happens next (and to cancel). Erased later by eraseDueAccounts.
 */
export async function requestDeletion(userId: string, keepSessionId: string | null, now = new Date()) {
  const closing = (await shopsClosingWith(userId)).filter((s) => s.closes).map((s) => s.id);
  await db.$transaction([
    db.user.update({ where: { id: userId }, data: { deletionRequestedAt: now } }),
    db.business.updateMany({ where: { id: { in: closing } }, data: { closingAt: now, closingById: userId } }),
    db.session.updateMany({ where: { userId, revokedAt: null, ...(keepSessionId ? { id: { not: keepSessionId } } : {}) }, data: { revokedAt: now } }),
    db.platformAudit.create({ data: { actorId: userId, action: "account_delete_requested", data: JSON.stringify({ shops: closing.length }) } }),
  ]);
}

/** Changes their mind before the erase date: the account and its shops open again. */
export async function cancelDeletion(userId: string) {
  await db.$transaction([
    db.user.update({ where: { id: userId }, data: { deletionRequestedAt: null } }),
    db.business.updateMany({ where: { closingById: userId }, data: { closingAt: null, closingById: null } }),
    db.platformAudit.create({ data: { actorId: userId, action: "account_delete_cancelled" } }),
  ]);
}

/**
 * Erases the accounts whose waiting time is over: the shops they alone owned, their place in other shops, their
 * sign-in codes and devices, then the person. Only a note that an account was erased, with no personal details, is
 * kept in the platform log (the IT Rules ask for such logs). Run hourly; safe to run as often as you like.
 */
export async function eraseDueAccounts(now = new Date()) {
  const { deleteDaysNum } = await readSite();
  const due = await db.user.findMany({ where: { deletionRequestedAt: { lte: new Date(now.getTime() - deleteDaysNum * 86_400_000) } } });
  let erased = 0, shops = 0;
  for (const u of due) {
    try {
      const owned = await db.business.findMany({ where: { closingById: u.id }, select: { id: true } });
      for (const b of owned) await eraseBusiness(b.id);
      shops += owned.length;
      await db.$transaction([
        db.membership.deleteMany({ where: { userId: u.id } }),
        db.session.deleteMany({ where: { userId: u.id } }),
        db.otpCode.deleteMany({ where: { OR: [...(u.email ? [{ email: u.email }] : []), ...(u.phone ? [{ phone: u.phone }] : [])] } }),
        db.platformAudit.deleteMany({ where: { actorId: u.id, action: { in: ["account_delete_requested", "account_delete_cancelled"] } } }),
        db.user.delete({ where: { id: u.id } }),
        db.platformAudit.create({ data: { actorId: "system", action: "account_erased", data: JSON.stringify({ requestedAt: u.deletionRequestedAt, shops: owned.length }) } }),
      ]);
      erased++;
    } catch (e) {
      console.error("[erase] could not erase an account", e instanceof Error ? e.message : e);
    }
  }
  return { erased, shops };
}
