import { describe, expect, it } from "vitest";
import { openDues, openByEntry } from "./ledger";
import {
  beatRunsOn, buysFewerCategories, cashRunning, checkCredit, distanceMeters, isLowStock, orderStatus, pendingMilli,
  priceFor, promiseStatus, snoozeUntil, stockLevel,
} from "./rules";
import { istDay } from "./ledger";

const d = (s: string) => new Date(`${s}T12:00:00+05:30`);
const fmt = (p: number) => `₹${p / 100}`;

describe("bill-wise settlement (CP-10)", () => {
  const entries = [
    { id: "b1", direction: "GAVE", amountPaise: 100000n, date: d("2026-08-01") },
    { id: "b2", direction: "GAVE", amountPaise: 50000n, date: d("2026-09-01") },
    { id: "r1", direction: "GOT", amountPaise: 60000n, date: d("2026-09-10") },
  ];
  it("settles the oldest bill first when nothing is assigned", () => {
    expect(openByEntry(entries).get("b1")).toBe(40000);
    expect(openByEntry(entries).get("b2")).toBe(50000);
  });
  it("settles the chosen bill first, then the oldest with what is left", () => {
    // ₹400 of the receipt goes to b2, the remaining ₹200 to the oldest bill b1
    const al = [{ receiptEntryId: "r1", invoiceEntryId: "b2", amountPaise: 40000n }];
    const o = openByEntry(entries, al);
    expect(o.get("b2")).toBe(10000);
    expect(o.get("b1")).toBe(80000);
  });
  it("keeps the remainder open on a partial payment and never over-applies", () => {
    const al = [{ receiptEntryId: "r1", invoiceEntryId: "b2", amountPaise: 999999n }];
    const o = openByEntry(entries, al);
    expect(o.has("b2")).toBe(false); // capped at the bill: ₹500 paid, ₹100 left of the receipt
    expect(o.get("b1")).toBe(90000);
  });
  it("ignores allocations whose receipt or bill was reversed", () => {
    const withReversal = [...entries, { id: "x", direction: "GAVE", amountPaise: 60000n, date: d("2026-09-11"), reversalOfId: "r1" }];
    const al = [{ receiptEntryId: "r1", invoiceEntryId: "b2", amountPaise: 40000n }];
    expect(openDues(withReversal, al).reduce((s, x) => s + x.open, 0)).toBe(150000);
  });
});

describe("credit control (CP-07)", () => {
  const base = { control: "BLOCK" as const, limitPaise: 100000, balance: 80000, overdue: 0, newAmount: 30000, blockOverdue: false, canOverride: false, fmt };
  it("blocks over the limit, warns for people who can override", () => {
    expect(checkCredit(base).action).toBe("block");
    expect(checkCredit({ ...base, canOverride: true }).action).toBe("warn");
    expect(checkCredit({ ...base, control: "WARN" }).action).toBe("warn");
    expect(checkCredit({ ...base, control: "OFF" }).action).toBe("ok");
  });
  it("is fine within the limit, and acts on overdue only when asked", () => {
    expect(checkCredit({ ...base, newAmount: 10000 }).action).toBe("ok");
    expect(checkCredit({ ...base, newAmount: 10000, overdue: 5000 }).action).toBe("ok");
    expect(checkCredit({ ...base, newAmount: 10000, overdue: 5000, blockOverdue: true }).action).toBe("block");
    expect(checkCredit({ ...base, limitPaise: null, newAmount: 1e9 }).action).toBe("ok");
  });
});

describe("promise to pay (CP-09)", () => {
  const p = { promisedFor: d("2026-10-10"), amountPaise: 50000, balanceNow: 120000, istDay };
  it("is open until the promised day passes", () => {
    expect(promiseStatus({ ...p, receivedSince: 0, today: d("2026-10-10") })).toBe("OPEN");
    expect(promiseStatus({ ...p, receivedSince: 0, today: d("2026-10-11") })).toBe("BROKEN");
  });
  it("is kept once enough has been paid, even early", () => {
    expect(promiseStatus({ ...p, receivedSince: 50000, today: d("2026-10-08") })).toBe("KEPT");
  });
  it("without an amount, is kept when the balance is cleared", () => {
    expect(promiseStatus({ ...p, amountPaise: null, balanceNow: 0, receivedSince: 1, today: d("2026-10-20") })).toBe("KEPT");
    expect(snoozeUntil(d("2026-10-10")).getTime() - d("2026-10-10").getTime()).toBe(86400000);
  });
});

describe("price lists (CI-03)", () => {
  const rows = [
    { itemId: "i", minQtyMilli: 0, ratePaise: 9000 },
    { itemId: "i", minQtyMilli: 10000, ratePaise: 8500 },
    { itemId: "i", minQtyMilli: 50000, ratePaise: 8000 },
    { itemId: "other", minQtyMilli: 0, ratePaise: 1 },
  ];
  it("picks the slab for the quantity and falls back to the standard price", () => {
    expect(priceFor(rows, "i", 1000, 10000)).toBe(9000);
    expect(priceFor(rows, "i", 10000, 10000)).toBe(8500);
    expect(priceFor(rows, "i", 60000, 10000)).toBe(8000);
    expect(priceFor(rows, "nope", 1000, 10000)).toBe(10000);
    expect(priceFor([{ itemId: "i", minQtyMilli: 5000, ratePaise: 1 }], "i", 1000, 777)).toBe(777);
  });
});

describe("stock and orders", () => {
  it("sums movements and flags low stock at the reorder level", () => {
    expect(stockLevel([{ qtyMilli: 10000 }, { qtyMilli: -3000 }])).toBe(7000);
    expect(isLowStock(5000, 5000)).toBe(true);
    expect(isLowStock(5001, 5000)).toBe(false);
    expect(isLowStock(0, null)).toBe(false);
  });
  it("tracks order fulfilment", () => {
    expect(orderStatus([{ qtyMilli: 5000, fulfilledMilli: 0 }])).toBe("OPEN");
    expect(orderStatus([{ qtyMilli: 5000, fulfilledMilli: 2000 }, { qtyMilli: 1000, fulfilledMilli: 1000 }])).toBe("PARTIAL");
    expect(orderStatus([{ qtyMilli: 5000, fulfilledMilli: 5000 }])).toBe("FULFILLED");
    expect(pendingMilli({ qtyMilli: 5000, fulfilledMilli: 6000 })).toBe(0);
  });
});

describe("cashbook, beats and categories", () => {
  it("keeps a running cash balance in time order", () => {
    const r = cashRunning(10000, [
      { at: d("2026-10-02"), direction: "OUT", amountPaise: 3000, label: "Tea" },
      { at: d("2026-10-01"), direction: "IN", amountPaise: 5000, label: "Sale" },
    ]);
    expect(r.map((x) => x.balance)).toEqual([15000, 12000]);
  });
  it("measures distance between coordinates", () => {
    // About 1.1 km apart in Hyderabad
    const m = distanceMeters({ lat: 17.385, lng: 78.4867 }, { lat: 17.395, lng: 78.4867 });
    expect(m).toBeGreaterThan(1090);
    expect(m).toBeLessThan(1130);
    expect(distanceMeters({ lat: 1, lng: 1 }, { lat: 1, lng: 1 })).toBe(0);
  });
  it("knows which weekdays a beat runs", () => {
    expect(beatRunsOn("1,3,5", 3)).toBe(true);
    expect(beatRunsOn("1,3,5", 0)).toBe(false);
  });
  it("flags parties buying from far fewer categories than peers", () => {
    expect(buysFewerCategories(1, [4, 5, 6, 4])).toBe(true);
    expect(buysFewerCategories(3, [4, 5, 6, 4])).toBe(false);
    expect(buysFewerCategories(1, [4, 5])).toBe(false);
    expect(buysFewerCategories(0, [1, 2, 2, 2])).toBe(false);
  });
});

import { changePct, daysIn, fyStartYear, previousOf, rangeDates, resolvePeriod } from "./period";

describe("report periods", () => {
  it("resolves presets in IST calendar terms", () => {
    expect(resolvePeriod({ period: "month" }, "2026-10-06")).toMatchObject({ from: "2026-10-01", to: "2026-10-31" });
    expect(resolvePeriod({ period: "lastmonth" }, "2026-01-15")).toMatchObject({ from: "2025-12-01", to: "2025-12-31" });
    expect(resolvePeriod({ period: "quarter" }, "2026-10-06")).toMatchObject({ from: "2026-10-01", to: "2026-12-31" });
    expect(resolvePeriod({ period: "7d" }, "2026-10-06")).toMatchObject({ from: "2026-09-30", to: "2026-10-06" });
  });
  it("uses the Indian financial year (April to March)", () => {
    expect(fyStartYear("2026-03-31")).toBe(2025);
    expect(fyStartYear("2026-04-01")).toBe(2026);
    expect(resolvePeriod({ period: "fy" }, "2026-10-06")).toMatchObject({ from: "2026-04-01", to: "2027-03-31" });
    expect(resolvePeriod({ period: "lastfy" }, "2026-02-10")).toMatchObject({ from: "2024-04-01", to: "2025-03-31" });
  });
  it("takes a valid custom range and falls back otherwise", () => {
    expect(resolvePeriod({ period: "custom", from: "2026-08-01", to: "2026-08-15" }, "2026-10-06")).toMatchObject({ from: "2026-08-01", to: "2026-08-15" });
    expect(resolvePeriod({ period: "custom", from: "2026-08-20", to: "2026-08-15" }, "2026-10-06")).toMatchObject({ from: "2026-10-01" });
    expect(resolvePeriod({ period: "nonsense" }, "2026-10-06").preset).toBe("month");
  });
  it("compares with an equal-length previous period", () => {
    expect(daysIn("2026-10-01", "2026-10-31")).toBe(31);
    expect(previousOf("2026-10-01", "2026-10-31")).toEqual({ from: "2026-08-31", to: "2026-09-30" });
    expect(resolvePeriod({ period: "month" }, "2026-10-06").prev).toEqual({ from: "2026-08-31", to: "2026-09-30" });
    expect(changePct(150, 100)).toBe(50);
    expect(changePct(50, 100)).toBe(-50);
    expect(changePct(10, 0)).toBeNull();
  });
  it("covers the whole last day of a range", () => {
    const r = rangeDates("2026-10-01", "2026-10-31");
    expect(r.lte.getTime() - r.gte.getTime()).toBe(31 * 86400_000 - 1);
  });
});
