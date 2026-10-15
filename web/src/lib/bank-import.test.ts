import { describe, expect, it } from "vitest";
import { buildTxns, counterparty, findHeaderRow, guessMapping, parseDate, parseMoney, txnHash } from "./bank-import";
import { categorize, kindOf } from "./categorize";

describe("dates", () => {
  it("reads the formats Indian banks use, day first", () => {
    expect(parseDate("14/10/2026")).toBe("2026-10-14");
    expect(parseDate("03-04-26")).toBe("2026-04-03");
    expect(parseDate("14-Oct-2026")).toBe("2026-10-14");
    expect(parseDate("14 Oct 26")).toBe("2026-10-14");
    expect(parseDate("2026-10-14 10:22:01")).toBe("2026-10-14");
    expect(parseDate("46309")).toBe("2026-10-14"); // Excel serial
  });
  it("refuses things that are not dates", () => {
    expect(parseDate("31/02/2026")).toBeNull();
    expect(parseDate("Opening Balance")).toBeNull();
    expect(parseDate("")).toBeNull();
  });
});

describe("amounts", () => {
  it("reads rupees with commas, symbols, brackets and Dr/Cr", () => {
    expect(parseMoney("1,23,456.50")?.paise).toBe(12345650);
    expect(parseMoney("₹ 500")?.paise).toBe(50000);
    expect(parseMoney("(250.00)")).toMatchObject({ paise: 25000, sign: -1 });
    expect(parseMoney("1,000.00 Cr")).toMatchObject({ paise: 100000, side: "IN" });
    expect(parseMoney("75 Dr")).toMatchObject({ paise: 7500, side: "OUT" });
    expect(parseMoney("-")).toBeNull();
    expect(parseMoney("abc")).toBeNull();
  });
});

describe("a statement with separate debit and credit columns and account details above it", () => {
  const table = [
    ["Account Statement", "", "", "", "", ""],
    ["Account No: XXXX1234", "", "", "", "", ""],
    ["Date", "Narration", "Chq./Ref.No.", "Withdrawal Amt.", "Deposit Amt.", "Closing Balance"],
    ["01/10/26", "UPI-RAVI TRADERS-ravi@okaxis-UTR123", "123456", "", "12,500.00", "62,500.00"],
    ["02/10/26", "ATM WDL HYDERABAD", "", "5,000.00", "", "57,500.00"],
    ["", "Opening balance", "", "", "", ""],
    ["03/10/26", "NEFT-SRI SAI WHOLESALE", "N777", "20,000.00", "", "37,500.00"],
  ];
  it("finds the table and builds the transactions", () => {
    const h = findHeaderRow(table);
    expect(h).toBe(2);
    const map = guessMapping(table[h]!);
    const { txns, errors } = buildTxns(table.slice(h + 1), map, h + 2);
    expect(errors).toEqual([]);
    expect(txns).toHaveLength(3);
    expect(txns[0]).toMatchObject({ date: "2026-10-01", direction: "IN", amountPaise: 1250000, balancePaise: 6250000, ref: "123456" });
    expect(txns[1]).toMatchObject({ direction: "OUT", amountPaise: 500000 });
  });
});

describe("a statement with one amount column", () => {
  it("uses Dr/Cr, a sign, or a separate type column", () => {
    const rows = [["01-Oct-2026", "Sale", "1,000.00 Cr"], ["02-Oct-2026", "Rent", "8,000.00 Dr"], ["03-Oct-2026", "Fuel", "-300.00"], ["04-Oct-2026", "Tea", "40"]];
    const { txns } = buildTxns(rows, { date: 0, description: 1, amount: 2 });
    expect(txns.map((t) => t.direction)).toEqual(["IN", "OUT", "OUT", "IN"]);
    const typed = buildTxns([["01/10/2026", "x", "500", "DR"], ["02/10/2026", "y", "700", "CR"]], { date: 0, description: 1, amount: 2, type: 3 });
    expect(typed.txns.map((t) => t.direction)).toEqual(["OUT", "IN"]);
  });
  it("reports rows it cannot read instead of dropping them silently", () => {
    const { txns, errors } = buildTxns([["31/02/2026", "bad", "10"], ["01/10/2026", "ok", "abc"], ["01/10/2026", "fine", "10"]], { date: 0, description: 1, amount: 2 });
    expect(txns).toHaveLength(1);
    expect(errors.map((e) => e.row)).toEqual([2, 3]);
  });
});

describe("duplicates", () => {
  it("gives the same fingerprint to the same transaction", () => {
    const t = { date: "2026-10-01", description: "UPI-RAVI", direction: "IN" as const, amountPaise: 100, balancePaise: 500, ref: "1" };
    expect(txnHash(t)).toBe(txnHash({ ...t, description: "upi ravi" }));
    expect(txnHash(t)).toBe(txnHash({ ...t, ref: null })); // one statement may have a reference column and another not
    expect(txnHash(t)).not.toBe(txnHash({ ...t, amountPaise: 101 }));
  });
});

describe("who and what", () => {
  it("finds the payee in common description layouts", () => {
    expect(counterparty("UPI/CR/412345678901/RAVI TRADERS/HDFC/ravi@okaxis")).toBe("Ravi Traders");
    expect(counterparty("UPI-LAKSHMI GENERAL STORES-lakshmi@ybl-UTR99")).toBe("Lakshmi General Stores");
    expect(counterparty("NEFT-HDFCN52026-SRI SAI WHOLESALE-REF1")).toBe("Sri Sai Wholesale");
    expect(counterparty("123456789")).toBeNull();
  });
  it("groups by the words in the description, and lets the shop's own rules win", () => {
    expect(categorize("ATM WDL HYDERABAD", "OUT")).toBe("Cash withdrawn");
    expect(categorize("NEFT SALARY OCT", "OUT")).toBe("Salaries & wages");
    expect(categorize("TSSPDCL BILL PAY", "OUT")).toBe("Electricity & water");
    expect(categorize("UPI-RAVI TRADERS", "IN")).toBe("Customer payments");
    expect(categorize("UPI-RAVI TRADERS", "OUT")).toBe("Stock & supplier payments");
    expect(categorize("UPI-RAVI TRADERS", "OUT", [{ keyword: "ravi traders", category: "Rent" }])).toBe("Rent");
    expect(categorize("anything", "IN", [{ keyword: "anything", category: "Rent" }])).toBe("Customer payments"); // a rule can't move money to the wrong direction
  });
  it("separates money earned and spent from money merely moved", () => {
    expect(kindOf("Rent")).toBe("spend");
    expect(kindOf("Customer payments")).toBe("income");
    expect(kindOf("Cash withdrawn")).toBe("transfer");
    expect(kindOf("Owner’s own use")).toBe("transfer");
  });
});
