/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeAll, describe, expect, it, vi } from "vitest";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

// Files go to a throwaway folder, so erasing them can be checked.
const uploads = await vi.hoisted(async () => {
  const [fs, os, p] = await Promise.all([import("node:fs"), import("node:os"), import("node:path")]);
  const dir = fs.mkdtempSync(p.join(os.tmpdir(), "finops-up-"));
  process.env.UPLOAD_DIR = dir;
  return dir;
});

const holder: { ctx: any; user: any; sid: string } = { ctx: null, user: null, sid: "" };
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("next/navigation", () => ({ redirect: (to: string) => { throw new Error(`REDIRECT ${to}`); }, notFound: () => { throw new Error("NOTFOUND"); }, forbidden: () => { throw new Error("FORBIDDEN"); } }));
vi.mock("@/lib/auth", async (orig) => {
  const real = await orig<typeof import("../src/lib/auth")>();
  return {
    ...real,
    requireBusiness: async () => holder.ctx,
    requireUser: async () => ({ user: await (await import("../src/lib/db")).db.user.findUniqueOrThrow({ where: { id: holder.user.id } }), session: { sid: holder.sid } }),
    findParty: (_c: unknown, id: string) => import("../src/lib/db").then(({ db }) => db.party.findFirst({ where: { id } })),
  };
});

import { db } from "../src/lib/db";
import { newShareToken } from "../src/lib/session";
import { hashPassword } from "../src/lib/password";
import { matchStatementPayments } from "../src/app/actions/money";
import { addPurchaseBill } from "../src/app/actions/purchases";
import { addCashSale } from "../src/app/actions/cash-sales";
import { keepAccount, requestAccountDeletion } from "../src/app/actions/account";
import { BUSINESS_TABLES, eraseDueAccounts, shopsClosingWith } from "../src/lib/erase";

const fd = (o: Record<string, string | string[]>) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) for (const x of Array.isArray(v) ? v : [v]) f.append(k, x); return f; };
const redirectOf = async (p: Promise<unknown>) => { try { await p; return null; } catch (e) { return String((e as Error).message); } };
const today = new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
const noon = (d: string) => new Date(`${d}T12:00:00+05:30`);
const uniq = () => Math.random().toString(36).slice(2, 10);

/** How many rows each shop table still holds for this shop. */
async function rowsOf(businessId: string) {
  const out: Record<string, number> = {};
  const m = db as any;
  for (const [name] of BUSINESS_TABLES) {
    const model = m[name[0]!.toLowerCase() + name.slice(1)];
    const where = { QuoteLine: { quote: { businessId } }, InvoiceLine: { invoice: { businessId } }, OrderLine: { order: { businessId } }, NoteLine: { note: { businessId } }, PriceListItem: { priceList: { businessId } }, BeatParty: { beat: { businessId } } }[name] ?? { businessId };
    out[name] = await model.count({ where });
  }
  return Object.fromEntries(Object.entries(out).filter(([, n]) => n > 0));
}

let owner: any, staff: any, shop: any, otherShop: any;
beforeAll(async () => {
  owner = await db.user.create({ data: { email: `leaving-${uniq()}@shop.test`, emailVerifiedAt: new Date(), name: "Leaving Owner", mobile: "919800000001", passwordHash: await hashPassword("the right password 9") } });
  staff = await db.user.create({ data: { email: `staff-${uniq()}@shop.test`, emailVerifiedAt: new Date(), name: "Staff" } });
  const someoneElse = await db.user.create({ data: { email: `other-${uniq()}@shop.test`, emailVerifiedAt: new Date(), name: "Other Owner" } });
  shop = await db.business.create({ data: { name: "Closing Shop", stateCode: "36" } });
  otherShop = await db.business.create({ data: { name: "Staying Shop", stateCode: "36" } });
  const membership = await db.membership.create({ data: { userId: owner.id, businessId: shop.id, role: "OWNER" } });
  await db.membership.create({ data: { userId: staff.id, businessId: shop.id, role: "BILLING" } });
  await db.membership.create({ data: { userId: someoneElse.id, businessId: otherShop.id, role: "OWNER" } });
  await db.membership.create({ data: { userId: owner.id, businessId: otherShop.id, role: "OWNER" } });
  await db.party.create({ data: { businessId: otherShop.id, name: "Their customer", stateCode: "36", shareToken: newShareToken() } });
  holder.user = owner;
  holder.ctx = { user: owner, business: shop, membership, role: "OWNER", branchId: null, assignedOnly: false, session: { sid: "x" } };

  // A shop with a bit of everything: customers, statement payments with bills and receipts, a supplier bill, a cash sale, a file.
  const ravi = await db.party.create({ data: { businessId: shop.id, name: "Ravi Tea Traders", phone: "919848012345", stateCode: "36", shareToken: newShareToken() } });
  const st = await db.statement.create({ data: { businessId: shop.id, name: "Oct", fromDate: noon(today), toDate: noon(today), rows: 2, createdById: owner.id } });
  const txn = await db.bankTxn.create({ data: { businessId: shop.id, statementId: st.id, date: noon(today), description: "UPI-RAVI", direction: "IN", amountPaise: 118000n, category: "Customer payments", counterparty: "Ravi", hash: uniq() } });
  expect((await matchStatementPayments({}, fd({ pick: [txn.id], mode: "BILL", billGst: "18", billItem: "Tea", confirmSales: "on", [`party_${txn.id}`]: ravi.id }))).ok).toBeTruthy();
  expect((await addPurchaseBill({}, fd({ supplierName: "Anil", gstin: "", state: "36", number: "A-1", date: today, total: "1180", rate: "18", kind: "SERVICES", paymentMode: "BANK" }))).ok).toBe(true);
  expect((await addCashSale({}, fd({ date: today, item: "Tea", amount: "20", mode: "upi" }))).ok).toBe(true);
  mkdirSync(path.join(uploads, shop.id), { recursive: true });
  writeFileSync(path.join(uploads, shop.id, "logo"), "x");
  await db.storedFile.create({ data: { businessId: shop.id, kind: "LOGO", name: "logo.png", mime: "image/png", size: 1, storageKey: `${shop.id}/logo`, createdById: owner.id } });

  const s1 = await db.session.create({ data: { userId: owner.id, businessId: shop.id, expiresAt: new Date(Date.now() + 86400_000) } });
  await db.session.create({ data: { userId: owner.id, businessId: shop.id, expiresAt: new Date(Date.now() + 86400_000) } });
  await db.session.create({ data: { userId: staff.id, businessId: shop.id, expiresAt: new Date(Date.now() + 86400_000) } });
  holder.sid = s1.id;
});

// The real settings are read, as the hourly job does outside any request; "delete within" is the default 30 days.
describe("deleting an account", () => {
  it("knows which shops close with it", async () => {
    const shops = await shopsClosingWith(owner.id);
    expect(shops.find((s) => s.id === shop.id)).toMatchObject({ closes: true, members: 2 });
    expect(shops.find((s) => s.id === otherShop.id)).toMatchObject({ closes: false });
    expect(Object.keys(await rowsOf(shop.id)).length).toBeGreaterThan(8);
  });

  it("asks for the password and the confirmation", async () => {
    expect((await requestAccountDeletion({}, fd({ password: "the right password 9" }))).error).toMatch(/Tick the box/);
    expect((await requestAccountDeletion({}, fd({ understand: "on", password: "wrong one here 1" }))).error).toMatch(/password isn’t right/);
    expect((await db.user.findUniqueOrThrow({ where: { id: owner.id } })).deletionRequestedAt).toBeNull();
  });

  it("closes the account and its shop at once, signing out the other devices", async () => {
    expect(await redirectOf(requestAccountDeletion({}, fd({ understand: "on", password: "the right password 9" })))).toBe("REDIRECT /account/delete");
    expect((await db.user.findUniqueOrThrow({ where: { id: owner.id } })).deletionRequestedAt).not.toBeNull();
    expect((await db.business.findUniqueOrThrow({ where: { id: shop.id } })).closingAt).not.toBeNull();
    expect((await db.business.findUniqueOrThrow({ where: { id: otherShop.id } })).closingAt).toBeNull();
    const sessions = await db.session.findMany({ where: { userId: owner.id } });
    expect(sessions.filter((s) => !s.revokedAt).map((s) => s.id)).toEqual([holder.sid]);
    // Nothing is erased while they can still change their mind.
    await eraseDueAccounts(new Date(Date.now() + 29 * 86400_000));
    expect(await db.user.findUnique({ where: { id: owner.id } })).not.toBeNull();
    expect(await db.business.findUnique({ where: { id: shop.id } })).not.toBeNull();
  });

  it("opens everything again when they keep the account", async () => {
    expect(await redirectOf(keepAccount())).toBe("REDIRECT /dashboard");
    expect((await db.user.findUniqueOrThrow({ where: { id: owner.id } })).deletionRequestedAt).toBeNull();
    expect((await db.business.findUniqueOrThrow({ where: { id: shop.id } })).closingAt).toBeNull();
  });

  it("erases the person and the shop they alone owned, and nothing else, once the days are over", async () => {
    await redirectOf(requestAccountDeletion({}, fd({ understand: "on", password: "the right password 9" })));
    expect((await eraseDueAccounts(new Date(Date.now() + 31 * 86400_000))).erased).toBeGreaterThanOrEqual(1);

    expect(await db.user.findUnique({ where: { id: owner.id } })).toBeNull();
    expect(await db.business.findUnique({ where: { id: shop.id } })).toBeNull();
    expect(await rowsOf(shop.id)).toEqual({});
    expect(await db.session.count({ where: { userId: owner.id } })).toBe(0);
    expect(existsSync(path.join(uploads, shop.id))).toBe(false);
    // The staff member keeps their own account; their device just no longer points at the erased shop.
    expect(await db.user.findUnique({ where: { id: staff.id } })).not.toBeNull();
    expect((await db.session.findFirstOrThrow({ where: { userId: staff.id } })).businessId).toBeNull();
    // The shop with another owner stays, with its records; the leaving owner is only removed from it.
    expect(await db.business.findUnique({ where: { id: otherShop.id } })).not.toBeNull();
    expect(await db.party.count({ where: { businessId: otherShop.id } })).toBe(1);
    expect(await db.membership.count({ where: { businessId: otherShop.id } })).toBe(1);
    // Only an anonymous note that an account was erased is left behind.
    const notes = await db.platformAudit.findMany({ where: { actorId: owner.id } });
    expect(notes).toEqual([]);
    expect(await db.platformAudit.count({ where: { action: "account_erased" } })).toBeGreaterThan(0);
  });
});

