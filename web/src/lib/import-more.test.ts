import { describe, expect, it } from "vitest";
import { checkCashSaleRow, checkExpenseRow, checkInvoiceRow, checkPaymentRow, checkPriceRow, checkStockRow, parseMode } from "./import-more";

const row = (o: Record<string, string>) => (k: string) => o[k] ?? "";

describe("parseMode", () => {
  it("understands common words", () => {
    expect(parseMode("GPay")).toBe("UPI");
    expect(parseMode("NEFT")).toBe("BANK");
    expect(parseMode("Cash")).toBe("CASH");
    expect(parseMode("")).toBeUndefined();
    expect(parseMode("barter")).toBeNull();
  });
});

describe("checkExpenseRow", () => {
  it("reads a good row and defaults the category and mode", () => {
    const r = checkExpenseRow(row({ date: "01/10/2026", amount: "1,200.50" }));
    expect(r.ok && r.value).toMatchObject({ date: "2026-10-01", amountPaise: 120050, category: "Other", mode: "CASH" });
  });
  it("rejects a future date and a zero amount", () => {
    expect(checkExpenseRow(row({ date: "2999-01-01", amount: "5" })).ok).toBe(false);
    expect(checkExpenseRow(row({ date: "2026-10-01", amount: "0" })).ok).toBe(false);
  });
});

describe("checkPaymentRow", () => {
  it("needs exactly one of got or gave", () => {
    expect(checkPaymentRow(row({ date: "2026-10-03", party: "Ravi", got: "500" })).ok).toBe(true);
    expect(checkPaymentRow(row({ date: "2026-10-03", party: "Ravi", got: "500", gave: "300" })).ok).toBe(false);
    expect(checkPaymentRow(row({ date: "2026-10-03", party: "Ravi" })).ok).toBe(false);
  });
  it("marks credit given as GAVE without a payment mode", () => {
    const r = checkPaymentRow(row({ date: "2026-10-03", party: "Ravi", gave: "1000", mode: "upi" }));
    expect(r.ok && r.value).toMatchObject({ direction: "GAVE", mode: null, amountPaise: 100000 });
  });
});

describe("checkInvoiceRow", () => {
  it("works out the tax and the state", () => {
    const r = checkInvoiceRow(row({ number: "OLD-1", date: "12/06/2026", party: "Lakshmi", taxable: "8000", gst: "5" }), "36");
    expect(r.ok && r.value).toMatchObject({ stateCode: "36", totalPaise: 840000, rateBp: 500 });
  });
  it("uses IGST for another state and finds the rate from the tax amounts", () => {
    const r = checkInvoiceRow(row({ number: "X", date: "2026-06-12", party: "Z", state: "Karnataka", taxable: "1000", igst: "180" }), "36");
    expect(r.ok && r.value.tax).toEqual({ cgst: 0, sgst: 0, igst: 18000 });
    expect(r.ok && r.value.rateBp).toBe(1800);
  });
  it("needs a bill number and a customer", () => {
    expect(checkInvoiceRow(row({ date: "2026-06-12", party: "Z", taxable: "1", gst: "5" }), "36").ok).toBe(false);
    expect(checkInvoiceRow(row({ number: "1", date: "2026-06-12", taxable: "1", gst: "5" }), "36").ok).toBe(false);
  });
});

describe("checkStockRow / checkCashSaleRow / checkPriceRow", () => {
  it("reads quantities", () => {
    expect(checkStockRow(row({ item: "Tea", qty: "12.5" }))).toMatchObject({ ok: true, value: { qtyMilli: 12500 } });
    expect(checkStockRow(row({ item: "Tea", qty: "lots" })).ok).toBe(false);
  });
  it("reads a cash sale without a quantity", () => {
    const r = checkCashSaleRow(row({ date: "2026-10-06", item: "Tea", amount: "30" }));
    expect(r.ok && r.value).toMatchObject({ qtyMilli: null, amountPaise: 3000, mode: "CASH" });
  });
  it("reads a price slab", () => {
    const r = checkPriceRow(row({ list: "Dealer", item: "Tea", rate: "360", minQty: "50" }));
    expect(r.ok && r.value).toMatchObject({ ratePaise: 36000, minQtyMilli: 50000 });
    expect(checkPriceRow(row({ list: "", item: "Tea", rate: "1" })).ok).toBe(false);
  });
});
