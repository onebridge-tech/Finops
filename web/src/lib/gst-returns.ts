// Preparing GST return data (GSTR-1 sections, HSN summary, GSTR-3B summary) from invoices, credit notes and purchase bills.
// Pure and unit-tested. These are prepared figures for the owner or accountant to check and upload; they are not a filing.

export type Doc = {
  number: string;
  date: string; // yyyy-mm-dd
  partyName: string;
  partyGstin: string | null;
  placeOfSupply: string; // 2-digit state code
  interState: boolean;
  totalPaise: number;
  status: string; // ISSUED | CANCELLED
  lines: { description: string; hsn: string | null; unit: string; qtyMilli: number; taxRateBp: number; taxablePaise: number; cgstPaise: number; sgstPaise: number; igstPaise: number }[];
};

export type Purchase = { taxablePaise: number; cgstPaise: number; sgstPaise: number; igstPaise: number; itcEligible: boolean; kind: string; voided: boolean };

export type RateBucket = { rateBp: number; taxable: number; cgst: number; sgst: number; igst: number };

/** Large inter-state sales to someone without a GSTIN (more than ₹2.5 lakh) are reported invoice by invoice. */
export const B2CL_LIMIT_PAISE = 25_000_000;

const add = (m: Map<number, RateBucket>, l: Doc["lines"][number]) => {
  const b = m.get(l.taxRateBp) ?? { rateBp: l.taxRateBp, taxable: 0, cgst: 0, sgst: 0, igst: 0 };
  b.taxable += l.taxablePaise; b.cgst += l.cgstPaise; b.sgst += l.sgstPaise; b.igst += l.igstPaise;
  m.set(l.taxRateBp, b);
};
const buckets = (d: Doc) => {
  const m = new Map<number, RateBucket>();
  for (const l of d.lines) add(m, l);
  return [...m.values()].sort((a, b) => a.rateBp - b.rateBp);
};

export type Gstr1 = {
  b2b: { gstin: string; invoices: { doc: Doc; rates: RateBucket[] }[] }[];
  b2cl: { doc: Doc; rates: RateBucket[] }[];
  b2cs: { placeOfSupply: string; interState: boolean; rateBp: number; taxable: number; cgst: number; sgst: number; igst: number }[];
  credit: { doc: Doc; gstin: string | null; rates: RateBucket[] }[];
  hsn: { hsn: string; description: string; unit: string; qtyMilli: number; rateBp: number; taxable: number; cgst: number; sgst: number; igst: number; total: number }[];
  docs: { type: string; from: string; to: string; total: number; cancelled: number }[];
  totals: { taxable: number; cgst: number; sgst: number; igst: number; invoices: number };
  warnings: string[];
};

const live = (d: Doc) => d.status !== "CANCELLED";

/** Splits sales into the GSTR-1 sections. `invoices` and `creditNotes` must already be limited to the return period. */
export function buildGstr1(invoices: Doc[], creditNotes: Doc[]): Gstr1 {
  const warnings: string[] = [];
  const sales = invoices.filter(live);
  const b2bMap = new Map<string, { doc: Doc; rates: RateBucket[] }[]>();
  const b2cl: Gstr1["b2cl"] = [];
  const b2cs = new Map<string, Gstr1["b2cs"][number]>();

  for (const d of sales) {
    if (d.partyGstin) {
      const arr = b2bMap.get(d.partyGstin) ?? [];
      arr.push({ doc: d, rates: buckets(d) });
      b2bMap.set(d.partyGstin, arr);
    } else if (d.interState && d.totalPaise > B2CL_LIMIT_PAISE) {
      b2cl.push({ doc: d, rates: buckets(d) });
    } else {
      for (const r of buckets(d)) {
        const k = `${d.placeOfSupply}|${d.interState ? 1 : 0}|${r.rateBp}`;
        const x = b2cs.get(k) ?? { placeOfSupply: d.placeOfSupply, interState: d.interState, rateBp: r.rateBp, taxable: 0, cgst: 0, sgst: 0, igst: 0 };
        x.taxable += r.taxable; x.cgst += r.cgst; x.sgst += r.sgst; x.igst += r.igst;
        b2cs.set(k, x);
      }
    }
    if (!d.placeOfSupply) warnings.push(`Invoice ${d.number} has no place of supply`);
    for (const l of d.lines) if (!l.hsn) { warnings.push(`Invoice ${d.number}: “${l.description}” has no HSN/SAC code`); break; }
  }

  const credit = creditNotes.filter(live).map((d) => ({ doc: d, gstin: d.partyGstin, rates: buckets(d) }));

  const hsnMap = new Map<string, Gstr1["hsn"][number]>();
  const hsnFrom = (d: Doc, sign: 1 | -1) => {
    for (const l of d.lines) {
      const code = l.hsn ?? "";
      const k = `${code}|${l.taxRateBp}|${l.unit.toUpperCase()}`;
      const x = hsnMap.get(k) ?? { hsn: code, description: l.description, unit: l.unit, qtyMilli: 0, rateBp: l.taxRateBp, taxable: 0, cgst: 0, sgst: 0, igst: 0, total: 0 };
      x.qtyMilli += sign * l.qtyMilli; x.taxable += sign * l.taxablePaise; x.cgst += sign * l.cgstPaise; x.sgst += sign * l.sgstPaise; x.igst += sign * l.igstPaise;
      x.total += sign * (l.taxablePaise + l.cgstPaise + l.sgstPaise + l.igstPaise);
      hsnMap.set(k, x);
    }
  };
  for (const d of sales) hsnFrom(d, 1);
  for (const d of creditNotes.filter(live)) hsnFrom(d, -1);

  const series = (type: string, all: Doc[]): Gstr1["docs"][number][] => {
    if (all.length === 0) return [];
    const sorted = [...all].sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }));
    return [{ type, from: sorted[0].number, to: sorted[sorted.length - 1].number, total: all.length, cancelled: all.filter((d) => !live(d)).length }];
  };

  const sum = (f: (b: RateBucket) => number) => sales.reduce((s, d) => s + buckets(d).reduce((t, b) => t + f(b), 0), 0);
  return {
    b2b: [...b2bMap].map(([gstin, invs]) => ({ gstin, invoices: invs })).sort((a, b) => a.gstin.localeCompare(b.gstin)),
    b2cl,
    b2cs: [...b2cs.values()].sort((a, b) => a.placeOfSupply.localeCompare(b.placeOfSupply) || a.rateBp - b.rateBp),
    credit,
    hsn: [...hsnMap.values()].sort((a, b) => a.hsn.localeCompare(b.hsn) || a.rateBp - b.rateBp),
    docs: [...series("Invoices for outward supply", invoices), ...series("Credit notes", creditNotes)],
    totals: { taxable: sum((b) => b.taxable), cgst: sum((b) => b.cgst), sgst: sum((b) => b.sgst), igst: sum((b) => b.igst), invoices: sales.length },
    warnings: [...new Set(warnings)],
  };
}

export type Gstr3b = {
  outward: { taxable: number; cgst: number; sgst: number; igst: number };
  nilRated: { taxable: number };
  creditNotes: { taxable: number; cgst: number; sgst: number; igst: number };
  itc: { cgst: number; sgst: number; igst: number };
  itcBlocked: { cgst: number; sgst: number; igst: number };
  payable: { cgst: number; sgst: number; igst: number; total: number };
  carryForward: { cgst: number; sgst: number; igst: number };
};

/**
 * Table 3.1 (outward supplies after credit notes), Table 4 (input credit from purchase bills) and the tax left to pay.
 * Credit is applied head by head here; the portal also lets IGST credit pay CGST and SGST, which the owner or accountant chooses there.
 */
export function buildGstr3b(sales: Doc[], creditNotes: Doc[], purchases: Purchase[]): Gstr3b {
  const taxable = { taxable: 0, cgst: 0, sgst: 0, igst: 0 };
  const nil = { taxable: 0 };
  for (const d of sales.filter(live)) for (const l of d.lines) {
    if (l.taxRateBp === 0) { nil.taxable += l.taxablePaise; continue; }
    taxable.taxable += l.taxablePaise; taxable.cgst += l.cgstPaise; taxable.sgst += l.sgstPaise; taxable.igst += l.igstPaise;
  }
  const cn = { taxable: 0, cgst: 0, sgst: 0, igst: 0 };
  for (const d of creditNotes.filter(live)) for (const l of d.lines) {
    if (l.taxRateBp === 0) { nil.taxable -= l.taxablePaise; continue; }
    cn.taxable += l.taxablePaise; cn.cgst += l.cgstPaise; cn.sgst += l.sgstPaise; cn.igst += l.igstPaise;
  }
  const itc = { cgst: 0, sgst: 0, igst: 0 };
  const blocked = { cgst: 0, sgst: 0, igst: 0 };
  for (const p of purchases.filter((x) => !x.voided)) {
    const t = p.itcEligible ? itc : blocked;
    t.cgst += p.cgstPaise; t.sgst += p.sgstPaise; t.igst += p.igstPaise;
  }
  const net = { cgst: taxable.cgst - cn.cgst, sgst: taxable.sgst - cn.sgst, igst: taxable.igst - cn.igst };
  const pay = (k: "cgst" | "sgst" | "igst") => Math.max(0, net[k] - itc[k]);
  const left = (k: "cgst" | "sgst" | "igst") => Math.max(0, itc[k] - net[k]);
  const payable = { cgst: pay("cgst"), sgst: pay("sgst"), igst: pay("igst"), total: 0 };
  payable.total = payable.cgst + payable.sgst + payable.igst;
  return { outward: taxable, nilRated: nil, creditNotes: cn, itc, itcBlocked: blocked, payable, carryForward: { cgst: left("cgst"), sgst: left("sgst"), igst: left("igst") } };
}

// ── The file the GST portal's offline tool accepts ──────────────────────────────────────────────

const UQC: Record<string, string> = { pcs: "PCS", nos: "NOS", kg: "KGS", kgs: "KGS", g: "GMS", gm: "GMS", ltr: "LTR", l: "LTR", litre: "LTR", ml: "MLT", m: "MTR", mtr: "MTR", box: "BOX", bag: "BAG", dozen: "DOZ", pack: "PAC", packet: "PAC", set: "SET", pair: "PRS", ton: "TON" };
export const uqc = (unit: string) => UQC[unit.trim().toLowerCase()] ?? "OTH";

const rs = (p: number) => Math.round(p) / 100;
const dmy = (ymd: string) => `${ymd.slice(8, 10)}-${ymd.slice(5, 7)}-${ymd.slice(0, 4)}`;
const items = (rates: RateBucket[]) => rates.map((r, i) => ({ num: i + 1, itm_det: { rt: r.rateBp / 100, txval: rs(r.taxable), iamt: rs(r.igst), camt: rs(r.cgst), samt: rs(r.sgst), csamt: 0 } }));

/** GSTR-1 as the offline tool's JSON, for upload on the GST portal. `fp` is the return period as MMYYYY. */
export function gstr1Json(gstin: string, fp: string, g: Gstr1) {
  return {
    gstin, fp, gt: 0, cur_gt: 0,
    ...(g.b2b.length ? { b2b: g.b2b.map((c) => ({ ctin: c.gstin, inv: c.invoices.map(({ doc, rates }) => ({ inum: doc.number, idt: dmy(doc.date), val: rs(doc.totalPaise), pos: doc.placeOfSupply, rchrg: "N", inv_typ: "R", itms: items(rates) })) })) } : {}),
    ...(g.b2cl.length ? { b2cl: [...Map.groupBy(g.b2cl, (x) => x.doc.placeOfSupply)].map(([pos, list]) => ({ pos, inv: list.map(({ doc, rates }) => ({ inum: doc.number, idt: dmy(doc.date), val: rs(doc.totalPaise), itms: items(rates) })) })) } : {}),
    ...(g.b2cs.length ? { b2cs: g.b2cs.map((x) => ({ sply_ty: x.interState ? "INTER" : "INTRA", rt: x.rateBp / 100, typ: "OE", pos: x.placeOfSupply, txval: rs(x.taxable), iamt: rs(x.igst), camt: rs(x.cgst), samt: rs(x.sgst), csamt: 0 })) } : {}),
    ...(g.credit.some((c) => c.gstin) ? { cdnr: [...Map.groupBy(g.credit.filter((c) => c.gstin), (c) => c.gstin!)].map(([ctin, list]) => ({ ctin, nt: list.map(({ doc, rates }) => ({ ntty: "C", nt_num: doc.number, nt_dt: dmy(doc.date), val: rs(doc.totalPaise), pos: doc.placeOfSupply, rchrg: "N", inv_typ: "R", itms: items(rates) })) })) } : {}),
    ...(g.hsn.length ? { hsn: { data: g.hsn.map((h, i) => ({ num: i + 1, hsn_sc: h.hsn, desc: h.description.slice(0, 30), uqc: uqc(h.unit), qty: h.qtyMilli / 1000, val: rs(h.total), txval: rs(h.taxable), iamt: rs(h.igst), camt: rs(h.cgst), samt: rs(h.sgst), csamt: 0 })) } } : {}),
    ...(g.docs.length ? { doc_issue: { doc_det: g.docs.map((d) => ({ doc_num: d.type.startsWith("Credit") ? 5 : 1, docs: [{ num: 1, from: d.from, to: d.to, totnum: d.total, cancel: d.cancelled, net_issue: d.total - d.cancelled }] })) } } : {}),
  };
}

/** "2026-10" → "102026", the way the portal writes a return period. */
export const returnPeriod = (ym: string) => `${ym.slice(5, 7)}${ym.slice(0, 4)}`;
