import { describe, expect, it } from "vitest";
import { estimateTax, incomeTax } from "./tax-estimate";

describe("incomeTax (new regime)", () => {
  it("is nil up to ₹12 lakh because of the rebate", () => {
    expect(incomeTax(400_000).total).toBe(0);
    expect(incomeTax(1_200_000).total).toBe(0);
  });
  it("taxes the slabs above the rebate limit, with cess", () => {
    // 12,00,001+: slab tax on 13 lakh = 4L@5% + 4L@10% + 1L@15% = 20,000 + 40,000 + 15,000 = 75,000; cess 3,000
    const t = incomeTax(1_300_000);
    expect(t.slabTax).toBe(75_000);
    expect(t.rebate).toBe(0);
    expect(t.total).toBe(78_000);
  });
  it("uses the top rate above ₹24 lakh", () => {
    expect(incomeTax(3_000_000).slabTax).toBe(20_000 + 40_000 + 60_000 + 80_000 + 100_000 + 180_000);
  });
  it("is zero for no income", () => {
    expect(incomeTax(0).total).toBe(0);
    expect(incomeTax(-5).total).toBe(0);
  });
});

describe("estimateTax", () => {
  it("works out deemed profit at 6% for digital and 8% for other receipts", () => {
    // turnover ₹10,00,000; half digital → 6% of 5L + 8% of 5L = 30,000 + 40,000
    const e = estimateTax({ turnoverPaise: 100_000_000, digitalReceiptsPaise: 50_000_000, allReceiptsPaise: 100_000_000, bookProfitPaise: 20_000_000 });
    expect(e.digitalShare).toBe(50);
    expect(e.presumptive.deemedProfit).toBe(70_000);
    expect(e.presumptive.eligible).toBe(true);
    expect(e.books.profit).toBe(200_000);
  });
  it("raises the limit when nearly all receipts are digital", () => {
    const high = { turnoverPaise: 25_000_000_00, allReceiptsPaise: 100, digitalReceiptsPaise: 100, bookProfitPaise: 0 };
    expect(estimateTax(high).presumptive.eligible).toBe(true);
    expect(estimateTax({ ...high, digitalReceiptsPaise: 0 }).presumptive.eligible).toBe(false);
  });
});
