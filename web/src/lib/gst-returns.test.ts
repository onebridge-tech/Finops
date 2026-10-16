import { describe, expect, it } from "vitest";
import { B2CL_LIMIT_PAISE, buildGstr1, buildGstr3b, gstr1Json, returnPeriod, uqc, type Doc } from "./gst-returns";

const line = (taxable: number, rateBp: number, inter: boolean, hsn: string | null = "0902") => {
  const tax = Math.round((taxable * rateBp) / 10000);
  return { description: "Tea", hsn, unit: "kg", qtyMilli: 2000, taxRateBp: rateBp, taxablePaise: taxable, cgstPaise: inter ? 0 : tax / 2, sgstPaise: inter ? 0 : tax / 2, igstPaise: inter ? tax : 0 };
};
const doc = (o: Partial<Doc> & { taxable?: number; rate?: number }): Doc => {
  const inter = o.interState ?? false;
  const l = line(o.taxable ?? 100000, o.rate ?? 500, inter);
  return { number: "INV-1", date: "2026-10-05", partyName: "Ravi", partyGstin: null, placeOfSupply: "36", interState: inter, totalPaise: l.taxablePaise + l.cgstPaise + l.sgstPaise + l.igstPaise, status: "ISSUED", lines: [l], ...o };
};

describe("buildGstr1", () => {
  it("puts sales to a GSTIN holder in B2B, grouped by buyer", () => {
    const g = buildGstr1([doc({ number: "INV-1", partyGstin: "36AAACB1234C1Z5" }), doc({ number: "INV-2", partyGstin: "36AAACB1234C1Z5" })], []);
    expect(g.b2b).toHaveLength(1);
    expect(g.b2b[0].invoices).toHaveLength(2);
    expect(g.b2cs).toHaveLength(0);
  });

  it("groups small consumer sales by place of supply and rate", () => {
    const g = buildGstr1([doc({ number: "A" }), doc({ number: "B" }), doc({ number: "C", rate: 1800 })], []);
    expect(g.b2cs).toHaveLength(2);
    expect(g.b2cs.find((x) => x.rateBp === 500)?.taxable).toBe(200000);
  });

  it("reports a large inter-state sale to an unregistered buyer one by one", () => {
    const big = doc({ number: "BIG", interState: true, placeOfSupply: "29", taxable: B2CL_LIMIT_PAISE, rate: 1800 });
    const g = buildGstr1([big], []);
    expect(g.b2cl).toHaveLength(1);
    expect(g.b2cs).toHaveLength(0);
  });

  it("leaves out cancelled invoices but counts them in the document series", () => {
    const g = buildGstr1([doc({ number: "INV-1" }), doc({ number: "INV-2", status: "CANCELLED" })], []);
    expect(g.totals.invoices).toBe(1);
    expect(g.docs[0]).toMatchObject({ from: "INV-1", to: "INV-2", total: 2, cancelled: 1 });
  });

  it("subtracts credit notes in the HSN summary and warns about a missing HSN", () => {
    const sale = doc({ number: "INV-1", taxable: 100000 });
    const cn = doc({ number: "CN-1", taxable: 20000 });
    const g = buildGstr1([sale], [cn]);
    expect(g.hsn[0].taxable).toBe(80000);
    const noHsn = buildGstr1([{ ...sale, lines: [{ ...sale.lines[0], hsn: null }] }], []);
    expect(noHsn.warnings.join(" ")).toMatch(/no HSN/);
  });
});

describe("buildGstr3b", () => {
  it("nets credit notes and input credit against the tax collected", () => {
    const sales = [doc({ taxable: 100000, rate: 1800 })]; // 900 + 900
    const cn = [doc({ number: "CN-1", taxable: 10000, rate: 1800 })]; // 90 + 90
    const purchases = [{ taxablePaise: 50000, cgstPaise: 4500, sgstPaise: 4500, igstPaise: 0, itcEligible: true, kind: "GOODS", voided: false }];
    const r = buildGstr3b(sales, cn, purchases);
    expect(r.outward.cgst).toBe(9000);
    expect(r.creditNotes.cgst).toBe(900);
    expect(r.payable.cgst).toBe(9000 - 900 - 4500);
    expect(r.payable.total).toBe(2 * (9000 - 900 - 4500));
  });

  it("carries forward credit that is more than the tax due", () => {
    const r = buildGstr3b([doc({ taxable: 10000, rate: 500 })], [], [{ taxablePaise: 100000, cgstPaise: 9000, sgstPaise: 9000, igstPaise: 0, itcEligible: true, kind: "GOODS", voided: false }]);
    expect(r.payable.total).toBe(0);
    expect(r.carryForward.cgst).toBe(9000 - 250);
  });

  it("keeps ineligible and cancelled bills out of the credit, and nil-rated sales out of the tax", () => {
    const r = buildGstr3b([doc({ taxable: 5000, rate: 0 })], [], [
      { taxablePaise: 1000, cgstPaise: 90, sgstPaise: 90, igstPaise: 0, itcEligible: false, kind: "GOODS", voided: false },
      { taxablePaise: 1000, cgstPaise: 90, sgstPaise: 90, igstPaise: 0, itcEligible: true, kind: "GOODS", voided: true },
    ]);
    expect(r.itc.cgst).toBe(0);
    expect(r.itcBlocked.cgst).toBe(90);
    expect(r.nilRated.taxable).toBe(5000);
    expect(r.outward.taxable).toBe(0);
  });
});

describe("gstr1Json", () => {
  it("writes the portal's field names, rupees and dd-mm-yyyy dates", () => {
    const g = buildGstr1([doc({ number: "INV-9", partyGstin: "36AAACB1234C1Z5", taxable: 100000, rate: 1800 }), doc({ number: "INV-10", taxable: 50000 })], []);
    const j = gstr1Json("36AAACB1234C1Z5", returnPeriod("2026-10"), g) as Record<string, unknown>;
    expect(j.fp).toBe("102026");
    const b2b = j.b2b as { ctin: string; inv: { inum: string; idt: string; val: number; itms: { itm_det: { rt: number; txval: number; camt: number } }[] }[] }[];
    expect(b2b[0].ctin).toBe("36AAACB1234C1Z5");
    expect(b2b[0].inv[0]).toMatchObject({ inum: "INV-9", idt: "05-10-2026", val: 1180 });
    expect(b2b[0].inv[0].itms[0].itm_det).toMatchObject({ rt: 18, txval: 1000, camt: 90 });
    expect((j.b2cs as unknown[]).length).toBe(1);
  });

  it("maps units to the portal's codes", () => {
    expect(uqc("kg")).toBe("KGS");
    expect(uqc("Pcs")).toBe("PCS");
    expect(uqc("bundle")).toBe("OTH");
  });
});
