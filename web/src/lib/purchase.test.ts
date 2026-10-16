import { describe, expect, it } from "vitest";
import { checkPurchaseRow, isInterStateBill, splitTax } from "./purchase";

const row = (o: Record<string, string>) => (k: string) => o[k] ?? "";

describe("splitTax", () => {
  it("splits an in-state bill into CGST and SGST", () => {
    expect(splitTax(100000, 1800, false)).toEqual({ cgst: 9000, sgst: 9000, igst: 0 });
  });
  it("uses IGST between states", () => {
    expect(splitTax(100000, 1800, true)).toEqual({ cgst: 0, sgst: 0, igst: 18000 });
  });
});

describe("isInterStateBill", () => {
  it("is false when a state is unknown", () => {
    expect(isInterStateBill(null, "36")).toBe(false);
    expect(isInterStateBill("36", "36")).toBe(false);
    expect(isInterStateBill("36", "29")).toBe(true);
  });
});

describe("checkPurchaseRow", () => {
  const base = { supplier: "Sri Sai Wholesale", number: "B-101", date: "15/10/2026", taxable: "1000", gst: "18" };

  it("works out the tax from a GST rate", () => {
    const r = checkPurchaseRow(row(base), "36");
    expect(r.ok && r.value.totalPaise).toBe(118000);
    expect(r.ok && r.value.tax).toEqual({ cgst: 9000, sgst: 9000, igst: 0 });
    expect(r.ok && r.value.date).toBe("2026-10-15");
  });

  it("works out the taxable value from a total", () => {
    const r = checkPurchaseRow(row({ ...base, taxable: "", total: "1180" }), "36");
    expect(r.ok && r.value.taxablePaise).toBe(100000);
  });

  it("uses IGST when the supplier is in another state", () => {
    const r = checkPurchaseRow(row({ ...base, state: "Karnataka" }), "36");
    expect(r.ok && r.value.tax).toEqual({ cgst: 0, sgst: 0, igst: 18000 });
  });

  it("accepts exact tax amounts", () => {
    const r = checkPurchaseRow(row({ supplier: "A", number: "1", date: "2026-10-01", taxable: "500", cgst: "12.50", sgst: "12.50" }), "36");
    expect(r.ok && r.value.totalPaise).toBe(52500);
  });

  it("rejects a total that does not match", () => {
    const r = checkPurchaseRow(row({ ...base, total: "1500" }), "36");
    expect(r.ok).toBe(false);
  });

  it("rejects a bad date, GSTIN or rate", () => {
    expect(checkPurchaseRow(row({ ...base, date: "32/13/2026" }), "36").ok).toBe(false);
    expect(checkPurchaseRow(row({ ...base, gstin: "36AAAAA0000A1Z0" }), "36").ok).toBe(false);
    expect(checkPurchaseRow(row({ ...base, gst: "17" }), "36").ok).toBe(false);
  });

  it("gives no credit without a supplier GSTIN", () => {
    const r = checkPurchaseRow(row(base), "36");
    expect(r.ok && r.value.itcEligible).toBe(false);
  });
});
