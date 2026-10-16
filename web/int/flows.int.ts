import { beforeAll, describe, expect, it } from "vitest";
import { db } from "../src/lib/db";
import { loadGst } from "../src/lib/gst-data";
import { loadYearEnd } from "../src/lib/year-end";
import { commitMore } from "../src/lib/import-commit";
import { EXPORTS, exportTable } from "../src/lib/exports";
import { profitAndLoss } from "../src/lib/finance";
import { cashbook } from "../src/lib/cashbook";
import { writeWorkbook } from "../src/lib/spreadsheet";
import { issueInvoice } from "../src/lib/doc-core";
import { newShareToken } from "../src/lib/session";
import { fyStartYear } from "../src/lib/period";
import { todayIST } from "../src/lib/format";

let ctx: any;
const month = todayIST().slice(0, 7);
const today = todayIST();
const noon = (d: string) => new Date(`${d}T12:00:00+05:30`);

beforeAll(async () => {
  const user = await db.user.create({ data: { phone: "9" + Math.floor(Math.random() * 1e9).toString().padStart(9, "0"), name: "Owner" } });
  const business = await db.business.create({ data: { name: "Int Test Shop", gstin: "36AAACB1234C1ZG", stateCode: "36" } });
  const membership = await db.membership.create({ data: { userId: user.id, businessId: business.id, role: "OWNER" } });
  ctx = { user, business, membership, role: "OWNER", branchId: null, assignedOnly: false, session: { sid: "x" } };
});

describe("end to end against a real Postgres", () => {
  it("issues invoices and prepares GSTR-1 / 3B", async () => {
    const reg = await db.party.create({ data: { businessId: ctx.business.id, name: "Ravi Traders", gstin: "36AAACB1234C1ZG", stateCode: "36", shareToken: newShareToken() } });
    const walk = await db.party.create({ data: { businessId: ctx.business.id, name: "Anil", stateCode: "29", shareToken: newShareToken() } });
    await db.$transaction(async (tx) => {
      await issueInvoice(tx, { businessId: ctx.business.id, userId: ctx.user.id, partyId: reg.id, branchId: null, date: noon(today), dueDate: null, placeOfSupply: "36", notes: null, lines: [{ itemId: null, description: "Tea", hsn: "0902", qtyMilli: 2000, unit: "kg", ratePaise: 40000, taxRateBp: 500, discountBp: 0 }] });
      await issueInvoice(tx, { businessId: ctx.business.id, userId: ctx.user.id, partyId: walk.id, branchId: null, date: noon(today), dueDate: null, placeOfSupply: "29", notes: null, lines: [{ itemId: null, description: "Sugar", hsn: null, qtyMilli: 1000, unit: "kg", ratePaise: 100000, taxRateBp: 1800, discountBp: 0 }] });
    });
    await db.purchaseBill.create({ data: { businessId: ctx.business.id, supplierName: "Sai", supplierGstin: "36AAACB1234C1ZG", number: "B1", date: noon(today), taxablePaise: 100000n, cgstPaise: 9000n, sgstPaise: 9000n, igstPaise: 0n, totalPaise: 118000n, createdById: ctx.user.id } });
    const g = await loadGst(ctx, month);
    expect(g.gstr1.b2b).toHaveLength(1);
    expect(g.gstr1.b2cs).toHaveLength(1);
    expect(g.gstr1.b2cs[0].igst).toBe(18000);
    expect(g.gstr1.warnings.join(" ")).toMatch(/no HSN/);
    expect(g.gstr3b.itc.cgst).toBe(9000);
    expect(g.gstr3b.payable.igst).toBe(18000);
  });

  it("imports every kind, skips repeats, and reports bad rows", async () => {
    const party = await db.party.findFirstOrThrow({ where: { businessId: ctx.business.id, name: "Ravi Traders" } });
    await db.item.create({ data: { businessId: ctx.business.id, name: "Tea Powder", pricePaise: 42000n } });
    const run = async (kind: any, header: string[], rows: string[][], opts = { postToLedger: false, stockMode: "set" as const }) => {
      const idx = Object.fromEntries(header.map((h, i) => [h, i]));
      return commitMore(kind, ctx, rows, (r, k) => String(r[idx[k]] ?? ""), opts);
    };
    const p = await run("purchases", ["supplier", "gstin", "number", "date", "taxable", "gst"], [["Sri Sai", "36AAACB1234C1ZG", "P-1", today, "1000", "18"], ["", "", "P-2", today, "1", "5"]]);
    console.log(JSON.stringify(p)); expect(p.imported).toBe(1); expect(p.skipped).toHaveLength(1);
    expect((await run("purchases", ["supplier", "gstin", "number", "date", "taxable", "gst"], [["Sri Sai", "36AAACB1234C1ZG", "P-1", today, "1000", "18"]])).skipped[0].reason).toBe("Already exists");
    expect((await run("expenses", ["date", "amount", "category"], [[today, "500", "Rent"]])).imported).toBe(1);
    expect((await run("expenses", ["date", "amount", "category"], [[today, "500", "Rent"]])).imported).toBe(0);
    expect((await run("payments", ["date", "party", "got", "mode"], [[today, "Ravi Traders", "300", "upi"], [today, "Nobody", "5", ""]])).imported).toBe(1);
    expect((await run("invoices", ["number", "date", "party", "taxable", "gst"], [["OLD-1", today, "New Customer", "1000", "5"]], { postToLedger: true, stockMode: "set" })).imported).toBe(1);
    expect(await db.party.count({ where: { businessId: ctx.business.id, name: "New Customer" } })).toBe(1);
    expect(await db.ledgerEntry.count({ where: { businessId: ctx.business.id, source: "INVOICE", note: { contains: "imported" } } })).toBe(1);
    expect((await run("stock", ["item", "qty"], [["Tea Powder", "25"]])).imported).toBe(1);
    expect((await run("stock", ["item", "qty"], [["Tea Powder", "25"]])).imported).toBe(0);
    expect((await run("cashsales", ["date", "item", "amount"], [[today, "Tea", "30"]])).imported).toBe(1);
    expect((await run("pricelists", ["list", "item", "rate", "minQty"], [["Dealer", "Tea Powder", "380", "0"], ["Dealer", "Tea Powder", "360", "50"]])).imported).toBe(2);
    expect(party.id).toBeTruthy();
  });

  it("counts cash sales in profit and the cash book, and exports every list", async () => {
    const pl = await profitAndLoss(ctx, month);
    expect(pl.sales).toBeGreaterThan(0);
    const cb = await cashbook(ctx, today, today, null);
    expect(cb.rows.some((r: any) => String(r.label).startsWith("Cash sale"))).toBe(true);
    for (const name of EXPORTS) {
      const t = await exportTable(ctx.business.id, name);
      expect(t.header.length).toBeGreaterThan(2);
    }
  });

  it("builds the year-end pack as a real workbook", async () => {
    const y = await loadYearEnd(ctx, fyStartYear(today));
    expect(y.sheets.length).toBeGreaterThan(10);
    expect(y.totals.turnover).toBeGreaterThan(0);
    const bytes = await writeWorkbook(y.sheets);
    expect(bytes.length).toBeGreaterThan(5000);
  });
});
