import { describe, expect, it } from "vitest";
import { parseCsv, toCsv } from "./csv";
import { checkItemRow, checkPartyRow, guessMapping } from "./import-rows";
import { gstinCheckDigit } from "./gstin";

describe("csv", () => {
  it("parses quotes, embedded commas and newlines, CRLF and BOM", () => {
    const text = '﻿Name,Address,Balance\r\n"Sri Sai, Traders","Line 1\nLine 2",1500\r\nPlain,,"say ""hi"""\r\n\r\n';
    expect(parseCsv(text)).toEqual([
      ["Name", "Address", "Balance"],
      ["Sri Sai, Traders", "Line 1\nLine 2", "1500"],
      ["Plain", "", 'say "hi"'],
    ]);
  });
  it("reads tab-separated text", () => {
    expect(parseCsv("a\tb\n1\t2")).toEqual([["a", "b"], ["1", "2"]]);
  });
  it("round-trips and neutralises spreadsheet formulas", () => {
    const out = toCsv(["n", "v"], [["=HYPERLINK(1)", -500], ['a "b"', "x,y"]]);
    expect(out).toBe("﻿n,v\r\n'=HYPERLINK(1),-500\r\n\"a \"\"b\"\"\",\"x,y\"\r\n");
    expect(parseCsv(out)[1]).toEqual(["'=HYPERLINK(1)", "-500"]);
  });
});

describe("import rows", () => {
  const row = (o: Record<string, string>) => (k: string) => o[k] ?? "";
  const gstin = (b: string) => b + gstinCheckDigit(b);

  it("maps common Tally / Khatabook headers", () => {
    expect(guessMapping("parties", ["Ledger Name", "Mobile No", "GSTIN/UIN", "Closing Balance", "Dr/Cr"]))
      .toEqual({ name: 0, phone: 1, gstin: 2, opening: 3, openingType: 4 });
  });
  it("reads opening balances with Dr/Cr, signs and brackets", () => {
    const p = (opening: string, openingType = "") => checkPartyRow(row({ name: "A", opening, openingType }));
    expect(p("1,200.50 Dr")).toMatchObject({ ok: true, value: { openingPaise: 120050, openingDirection: "GAVE" } });
    expect(p("800 Cr")).toMatchObject({ ok: true, value: { openingDirection: "GOT" } });
    expect(p("-800")).toMatchObject({ ok: true, value: { openingPaise: 80000, openingDirection: "GOT" } });
    expect(p("(800)")).toMatchObject({ ok: true, value: { openingDirection: "GOT" } });
    expect(p("800", "Credit")).toMatchObject({ ok: true, value: { openingDirection: "GOT" } });
    expect(p("")).toMatchObject({ ok: true, value: { openingPaise: 0 } });
    expect(p("abc")).toMatchObject({ ok: false });
  });
  it("validates mobile, GSTIN, state and type", () => {
    expect(checkPartyRow(row({ name: "" }))).toEqual({ ok: false, error: "Name is missing" });
    expect(checkPartyRow(row({ name: "A", phone: "12345" })).ok).toBe(false);
    expect(checkPartyRow(row({ name: "A", gstin: "29AAGCB4321D1Z9" })).ok).toBe(false);
    expect(checkPartyRow(row({ name: "A", gstin: gstin("29AAGCB4321D1Z") }))).toMatchObject({ ok: true, value: { stateCode: "29" } });
    expect(checkPartyRow(row({ name: "A", state: "telangana" }))).toMatchObject({ ok: true, value: { stateCode: "36" } });
    expect(checkPartyRow(row({ name: "A", state: "7" }))).toMatchObject({ ok: true, value: { stateCode: "07" } });
    expect(checkPartyRow(row({ name: "A", state: "Atlantis" })).ok).toBe(false);
    expect(checkPartyRow(row({ name: "A", type: "Sundry Creditors" }))).toMatchObject({ ok: true, value: { type: "SUPPLIER" } });
    expect(checkPartyRow(row({ name: "A", phone: "98480 12345" }))).toMatchObject({ ok: true, value: { phone: "919848012345" } });
  });
  it("validates items", () => {
    expect(checkItemRow(row({ name: "Rice", price: "1,850", gst: "5%" }))).toMatchObject({ ok: true, value: { pricePaise: 185000, taxRateBp: 500, unit: "pcs" } });
    expect(checkItemRow(row({ name: "Rice", price: "10", gst: "7" })).ok).toBe(false);
    expect(checkItemRow(row({ name: "Rice", price: "" })).ok).toBe(false);
    expect(checkItemRow(row({ name: "Rice", price: "10" }))).toMatchObject({ ok: true, value: { taxRateBp: 1800 } });
  });
});

describe("import header matching", () => {
  it("re-imports the app's own export headers", () => {
    expect(guessMapping("items", ["Name", "Variant", "SKU", "Unit", "Sale price (₹)", "Purchase price (₹)", "GST %", "HSN/SAC"]))
      .toEqual({ name: 0, price: 4, purchasePrice: 5, gst: 6, hsn: 7, unit: 3, sku: 2 });
    expect(guessMapping("parties", ["Name", "Type", "Mobile", "Email", "GSTIN", "State", "Address", "Credit days", "Balance (₹)", "Dr/Cr"]).opening).toBe(8);
  });
});
