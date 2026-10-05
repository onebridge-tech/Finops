import { describe, expect, it } from "vitest";
import { formatINR, parseRupees, toRupeeString } from "./money";
import { gstinCheckDigit, isValidGstin, stateFromGstin } from "./gstin";
import { computeInvoice, computeLine } from "./gst";
import { balanceOf, overdueAmount, withRunningBalance } from "./ledger";
import { normalizeIndianMobile, upiLink, isValidUpiId } from "./share";

describe("money", () => {
  it("parses rupee input into paise", () => {
    expect(parseRupees("1,250.5")).toBe(125050);
    expect(parseRupees("₹ 99")).toBe(9900);
    expect(parseRupees("0.07")).toBe(7);
    expect(parseRupees("1.234")).toBeNull();
    expect(parseRupees("-5")).toBeNull();
    expect(parseRupees("abc")).toBeNull();
  });
  it("formats", () => {
    expect(toRupeeString(125050)).toBe("1250.50");
    expect(toRupeeString(7)).toBe("0.07");
    expect(formatINR(12345678)).toBe("₹1,23,456.78");
  });
});

describe("gstin", () => {
  it("accepts a GSTIN with a correct check digit", () => {
    const base = "27AAPFU0939F1Z";
    const g = base + gstinCheckDigit(base);
    expect(isValidGstin(g)).toBe(true);
    expect(stateFromGstin(g)).toBe("27");
  });
  it("rejects a wrong check digit, bad format or unknown state", () => {
    const base = "36AAACB1234C1Z";
    const good = gstinCheckDigit(base);
    const bad = good === "A" ? "B" : "A";
    expect(isValidGstin(base + bad)).toBe(false);
    expect(isValidGstin("27AAPFU0939F1Z")).toBe(false);
    expect(isValidGstin("99AAPFU0939F1ZV")).toBe(false);
  });
});

describe("gst", () => {
  it("splits intra-state tax into CGST + SGST", () => {
    // 3 × ₹333.33 at 18%
    const l = computeLine({ description: "x", qtyMilli: 3000, ratePaise: 33333, taxRateBp: 1800 }, false);
    expect(l.taxable).toBe(99999);
    expect(l.cgst).toBe(9000); // 8999.91 → 9000
    expect(l.sgst).toBe(9000);
    expect(l.igst).toBe(0);
    expect(l.total).toBe(117999);
  });
  it("uses IGST inter-state and rounds the grand total to the rupee", () => {
    const inv = computeInvoice(
      [
        { description: "a", qtyMilli: 1500, ratePaise: 10050, taxRateBp: 1200 }, // 150.75 taxable
        { description: "b", qtyMilli: 1000, ratePaise: 99999, taxRateBp: 500 },
      ],
      true,
    );
    expect(inv.taxable).toBe(15075 + 99999);
    expect(inv.igst).toBe(1809 + 5000);
    expect(inv.cgst + inv.sgst).toBe(0);
    const exact = 15075 + 99999 + 1809 + 5000;
    expect(inv.total % 100).toBe(0);
    expect(inv.total - exact).toBe(inv.roundOff);
    expect(Math.abs(inv.roundOff)).toBeLessThanOrEqual(50);
  });
  it("handles zero-rated items", () => {
    expect(computeLine({ description: "x", qtyMilli: 2000, ratePaise: 500, taxRateBp: 0 }, false).total).toBe(1000);
  });
});

describe("ledger", () => {
  const d = (s: string) => new Date(s);
  const entries = [
    { id: "1", direction: "GAVE", amountPaise: 100000n, date: d("2026-09-01"), dueDate: d("2026-09-15") },
    { id: "2", direction: "GAVE", amountPaise: 50000n, date: d("2026-09-20"), dueDate: d("2026-10-30") },
    { id: "3", direction: "GOT", amountPaise: 30000n, date: d("2026-09-25") },
  ];
  it("computes balance and running balance", () => {
    expect(balanceOf(entries)).toBe(120000);
    expect(withRunningBalance(entries).map((e) => e.running)).toEqual([100000, 150000, 120000]);
  });
  it("applies payments to the oldest dues first when computing overdue", () => {
    expect(overdueAmount(entries, d("2026-10-05"))).toBe(70000);
    expect(overdueAmount(entries, d("2026-11-01"))).toBe(120000);
  });
  it("ignores reversed pairs for overdue but keeps balance consistent", () => {
    const withReversal = [
      ...entries,
      { id: "4", direction: "GOT", amountPaise: 50000n, date: d("2026-09-26"), reversalOfId: "2" },
    ];
    expect(balanceOf(withReversal)).toBe(70000);
    expect(overdueAmount(withReversal, d("2026-11-01"))).toBe(70000);
  });
});

describe("share", () => {
  it("normalises Indian mobiles", () => {
    expect(normalizeIndianMobile("98480 12345")).toBe("919848012345");
    expect(normalizeIndianMobile("+91-9848012345")).toBe("919848012345");
    expect(normalizeIndianMobile("09848012345")).toBe("919848012345");
    expect(normalizeIndianMobile("12345")).toBeNull();
  });
  it("builds UPI links", () => {
    expect(isValidUpiId("shop@okicici")).toBe(true);
    expect(isValidUpiId("not a vpa")).toBe(false);
    const link = upiLink({ vpa: "shop@okicici", payee: "Sri Sai Traders", amountPaise: 125050, note: "INV-1" });
    expect(link).toBe("upi://pay?pa=shop%40okicici&pn=Sri%20Sai%20Traders&cu=INR&am=1250.50&tn=INV-1");
  });
});

describe("amount in words", () => {
  it("uses the Indian numbering system", async () => {
    const { amountInWords, numberInWords } = await import("./words");
    expect(amountInWords(3629900)).toBe("Rupees Thirty Six Thousand Two Hundred Ninety Nine Only");
    expect(amountInWords(12345678950)).toBe("Rupees Twelve Crore Thirty Four Lakh Fifty Six Thousand Seven Hundred Eighty Nine and Fifty Paise Only");
    expect(amountInWords(100)).toBe("Rupees One Only");
    expect(amountInWords(5)).toBe("Rupees Zero and Five Paise Only");
    expect(numberInWords(100000)).toBe("One Lakh");
    expect(numberInWords(1010)).toBe("One Thousand Ten");
    expect(numberInWords(2000000000)).toBe("Two Hundred Crore");
  });
});

describe("line discounts", () => {
  it("applies the discount before GST", () => {
    // 2 × ₹1,000 less 10% = ₹1,800 taxable, 18% GST = ₹324
    const l = computeLine({ description: "x", qtyMilli: 2000, ratePaise: 100000, taxRateBp: 1800, discountBp: 1000 }, true);
    expect(l.taxable).toBe(180000);
    expect(l.igst).toBe(32400);
    // ₹333.33 less 2.5% = ₹325.00 (324.996… rounds up)
    expect(computeLine({ description: "x", qtyMilli: 1000, ratePaise: 33333, taxRateBp: 0, discountBp: 250 }, false).taxable).toBe(32500);
  });
});
