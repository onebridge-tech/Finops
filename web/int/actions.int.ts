/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeAll, describe, expect, it, vi } from "vitest";

const holder: { ctx: any } = { ctx: null };
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("next/navigation", () => ({ redirect: (to: string) => { throw new Error(`REDIRECT ${to}`); }, notFound: () => { throw new Error("NOTFOUND"); }, forbidden: () => { throw new Error("FORBIDDEN"); } }));
vi.mock("@/lib/auth", async (orig) => {
  const real = await orig<typeof import("../src/lib/auth")>();
  return { ...real, requireBusiness: async () => holder.ctx, findParty: (_c: unknown, id: string) => import("../src/lib/db").then(({ db }) => db.party.findFirst({ where: { id } })) };
});

import { db } from "../src/lib/db";
import { newShareToken } from "../src/lib/session";
import { matchStatementPayments, recordCustomerPayment } from "../src/app/actions/money";
import { addPurchaseBill, voidPurchaseBill } from "../src/app/actions/purchases";
import { saveNote } from "../src/app/actions/paper-notes";
import { addCashSale } from "../src/app/actions/cash-sales";
import { invoicePayments } from "../src/lib/queries";

const today = new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
const noon = (d: string) => new Date(`${d}T12:00:00+05:30`);
const fd = (o: Record<string, string | string[]>) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) for (const x of Array.isArray(v) ? v : [v]) f.append(k, x); return f; };

let bizId = "";
beforeAll(async () => {
  const user = await db.user.create({ data: { phone: "8" + Math.floor(Math.random() * 1e9).toString().padStart(9, "0"), name: "Owner2" } });
  const business = await db.business.create({ data: { name: "Action Shop", gstin: "36AAACB1234C1ZG", stateCode: "36" } });
  const membership = await db.membership.create({ data: { userId: user.id, businessId: business.id, role: "OWNER" } });
  holder.ctx = { user, business, membership, role: "OWNER", branchId: null, assignedOnly: false, session: { sid: "x" } };
  bizId = business.id;
});

describe("actions against a real Postgres", () => {
  it("writes statement payments with receipts, and makes bills that the payment settles", async () => {
    const ravi = await db.party.create({ data: { businessId: bizId, name: "Ravi Tea Traders", stateCode: "36", shareToken: newShareToken() } });
    const mk = (d: string, amt: bigint) => db.bankTxn.create({ data: { businessId: bizId, date: noon(today), description: d, direction: "IN", amountPaise: amt, category: "Customer payments", counterparty: "Ravi", hash: d + Math.random() } });
    const a = await mk("UPI-RAVI-1", 500000n);
    const b = await mk("UPI-RAVI-2", 118000n);
    // plain payment
    expect(await matchStatementPayments({}, fd({ pick: [a.id], mode: "PAYMENT", [`party_${a.id}`]: ravi.id }))).toMatchObject({ ok: expect.stringContaining("1 payment") });
    expect(await db.receipt.count({ where: { businessId: bizId } })).toBe(1);
    expect((await db.bankTxn.findUniqueOrThrow({ where: { id: a.id } })).entryId).toBeTruthy();
    // needs the confirmation
    expect((await matchStatementPayments({}, fd({ pick: [b.id], mode: "BILL", billGst: "18", billItem: "Tea", [`party_${b.id}`]: ravi.id }))).error).toMatch(/real sales/);
    // bill + payment
    const r = await matchStatementPayments({}, fd({ pick: [b.id], mode: "BILL", billGst: "18", billItem: "Tea", confirmSales: "on", [`party_${b.id}`]: ravi.id }));
    expect(r.ok).toMatch(/with bills/);
    const inv = await db.invoice.findFirstOrThrow({ where: { businessId: bizId } });
    expect(Number(inv.taxablePaise)).toBe(100000);
    expect(Number(inv.totalPaise)).toBe(118000);
    const pay = await invoicePayments(bizId, [inv]);
    expect(pay.get(inv.id)?.status).toBe("PAID");
    // again: nothing left to do
    expect((await matchStatementPayments({}, fd({ pick: [b.id], mode: "PAYMENT", [`party_${b.id}`]: ravi.id }))).error).toBeTruthy();
    // single-line action too
    const c = await mk("UPI-RAVI-3", 10000n);
    await recordCustomerPayment(fd({ id: c.id, partyId: ravi.id }));
    expect(await db.receipt.count({ where: { businessId: bizId } })).toBe(3);
  });

  it("adds, rejects duplicates of, and voids a supplier bill with its expense", async () => {
    const f = { supplierName: "Sri Sai", gstin: "36AAACB1234C1ZG", number: "S-1", date: today, taxable: "1000", rate: "18", kind: "GOODS", itcEligible: "on", alsoExpense: "on", paymentMode: "BANK" };
    expect((await addPurchaseBill({}, fd(f))).ok).toBe(true);
    expect((await addPurchaseBill({}, fd(f))).error).toMatch(/already recorded/);
    const bill = await db.purchaseBill.findFirstOrThrow({ where: { businessId: bizId } });
    expect(Number(bill.cgstPaise)).toBe(9000);
    expect(bill.expenseId).toBeTruthy();
    // only the total is known (from a bank line)
    expect((await addPurchaseBill({}, fd({ supplierName: "Anil", gstin: "", state: "36", number: "A-1", date: today, total: "1180", rate: "18", kind: "SERVICES", paymentMode: "BANK" }))).ok).toBe(true);
    const anil = await db.purchaseBill.findFirstOrThrow({ where: { businessId: bizId, number: "A-1" } });
    expect(Number(anil.taxablePaise)).toBe(100000);
    expect(anil.itcEligible).toBe(false);
    expect((await voidPurchaseBill({}, fd({ billId: bill.id, reason: "wrong bill" }))).ok).toBe(true);
    expect((await db.expense.findUniqueOrThrow({ where: { id: bill.expenseId! } })).voidedAt).toBeTruthy();
  });

  it("saves the checked lines of a paper note once", async () => {
    const scan = await db.noteScan.create({ data: { businessId: bizId, imageHash: "h" + Math.random(), createdById: holder.ctx.user.id, rowsJson: "{}" } });
    const rows = [
      { include: true, date: today, item: "Tea 2", qty: "2", amount: "30", type: "IN", mode: "CASH", category: "Other" },
      { include: true, date: today, item: "Milk", qty: "", amount: "200", type: "OUT", mode: "CASH", category: "Tea & snacks" },
      { include: false, date: today, item: "skip", qty: "", amount: "5", type: "IN", mode: "CASH", category: "Other" },
    ];
    await expect(saveNote({}, fd({ scanId: scan.id, rows: JSON.stringify(rows) }))).rejects.toThrow(/REDIRECT \/paper-notes\?saved=2/);
    expect(await db.cashSale.count({ where: { businessId: bizId, noteScanId: scan.id } })).toBe(1);
    expect(await db.expense.count({ where: { businessId: bizId, note: { contains: "Paper note" } } })).toBe(1);
    expect((await saveNote({}, fd({ scanId: scan.id, rows: JSON.stringify(rows) }))).error).toMatch(/already been saved/);
    expect((await addCashSale({}, fd({ date: today, item: "Tea", amount: "20", mode: "upi" }))).ok).toBe(true);
  });
});
