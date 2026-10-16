// Purchase bills: the tax split of a supplier bill and the checks on a row. Pure, so it is unit-tested.
import { parseRupees, roundHalfUp } from "./money";
import { GST_RATES_BP } from "./gst";
import { isValidGstin, normalizeGstin, STATES } from "./gstin";

export const PURCHASE_KINDS = ["GOODS", "SERVICES", "CAPITAL"] as const;
export type PurchaseKind = (typeof PURCHASE_KINDS)[number];
export const PURCHASE_KIND_LABEL: Record<PurchaseKind, string> = { GOODS: "Goods (stock)", SERVICES: "Services / expenses", CAPITAL: "Machinery / equipment" };

export type Tax = { cgst: number; sgst: number; igst: number };

/** GST on a bill at one rate: CGST + SGST within the state, IGST between states. */
export function splitTax(taxablePaise: number, rateBp: number, interState: boolean): Tax {
  if (interState) return { cgst: 0, sgst: 0, igst: roundHalfUp((taxablePaise * rateBp) / 10000) };
  const half = roundHalfUp((taxablePaise * rateBp) / 20000);
  return { cgst: half, sgst: half, igst: 0 };
}

/** Business state differs from the supplier's state → IGST. Unknown states count as the same state. */
export function isInterStateBill(businessState: string | null | undefined, supplierState: string | null | undefined): boolean {
  return !!businessState && !!supplierState && businessState !== supplierState;
}

export type PurchaseRow = {
  supplierName: string; supplierGstin: string | null; number: string; date: string; stateCode: string | null;
  taxablePaise: number; tax: Tax; totalPaise: number; kind: PurchaseKind; itcEligible: boolean; note: string | null;
};

export type Checked<T> = { ok: true; value: T } | { ok: false; error: string };

const norm = (s: string) => s.toLowerCase().replace(/\(.*?\)/g, " ").replace(/[₹%_.]+/g, " ").replace(/\s+/g, " ").trim();
const isoDate = (v: string): string | null => {
  const s = v.trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return fmt(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2}|\d{4})$/);
  if (m) return fmt(m[3].length === 2 ? 2000 + +m[3] : +m[3], +m[2], +m[1]);
  return null;
};
function fmt(y: number, mo: number, d: number): string | null {
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d ? dt.toISOString().slice(0, 10) : null;
}
export { isoDate };

const yes = (v: string) => /^(y|yes|true|1|eligible)/i.test(v.trim());
const no = (v: string) => /^(n|no|false|0|ineligible|blocked)/i.test(v.trim());

/**
 * One row of a spreadsheet of purchase bills. Tax can be given as a GST % (split for you), as CGST/SGST/IGST amounts,
 * or as a total from which the tax is worked out.
 */
export function checkPurchaseRow(get: (key: string) => string, businessState: string | null): Checked<PurchaseRow> {
  const supplierName = get("supplier").trim();
  if (!supplierName) return { ok: false, error: "Supplier name is missing" };
  const number = get("number").trim();
  if (!number) return { ok: false, error: "Bill number is missing" };
  const date = isoDate(get("date"));
  if (!date) return { ok: false, error: `Date "${get("date")}" is not a date` };
  const gstinRaw = normalizeGstin(get("gstin"));
  if (gstinRaw && !isValidGstin(gstinRaw)) return { ok: false, error: `GSTIN "${gstinRaw}" is not valid` };
  const stateRaw = get("state").trim();
  const stateCode = gstinRaw ? gstinRaw.slice(0, 2) : stateRaw && /^\d{1,2}$/.test(stateRaw) ? stateRaw.padStart(2, "0") : Object.entries(STATES).find(([, n]) => norm(n) === norm(stateRaw))?.[0] ?? null;
  if (stateRaw && !stateCode) return { ok: false, error: `Unknown state "${stateRaw}"` };
  const inter = isInterStateBill(businessState, stateCode);

  const amt = (key: string): number | null | undefined => {
    const v = get(key).trim();
    if (!v) return undefined;
    const p = parseRupees(v);
    return p === null ? null : p;
  };
  const taxableIn = amt("taxable");
  const totalIn = amt("total");
  const cg = amt("cgst"), sg = amt("sgst"), ig = amt("igst");
  for (const [k, v] of [["Taxable value", taxableIn], ["Total", totalIn], ["CGST", cg], ["SGST", sg], ["IGST", ig]] as const) if (v === null) return { ok: false, error: `${k} is not an amount` };

  const rateText = get("gst").trim().replace(/%$/, "");
  const rateBp = rateText === "" ? null : Math.round(Number(rateText) * 100);
  if (rateBp !== null && !GST_RATES_BP.includes(rateBp)) return { ok: false, error: `GST rate "${get("gst")}" should be one of 0, 0.25, 3, 5, 12, 18, 28` };

  let taxable: number, tax: Tax;
  if (cg !== undefined || sg !== undefined || ig !== undefined) {
    tax = { cgst: cg ?? 0, sgst: sg ?? 0, igst: ig ?? 0 };
    if (taxableIn !== undefined) taxable = taxableIn!;
    else if (totalIn !== undefined) taxable = totalIn! - tax.cgst - tax.sgst - tax.igst;
    else return { ok: false, error: "Give the taxable value or the total" };
  } else if (rateBp !== null) {
    if (taxableIn !== undefined) taxable = taxableIn!;
    else if (totalIn !== undefined) taxable = roundHalfUp((totalIn! * 10000) / (10000 + rateBp));
    else return { ok: false, error: "Give the taxable value or the total" };
    tax = splitTax(taxable, rateBp, inter);
  } else if (taxableIn !== undefined && totalIn !== undefined) {
    taxable = taxableIn!;
    const t = totalIn! - taxable;
    tax = inter ? { cgst: 0, sgst: 0, igst: t } : { cgst: Math.floor(t / 2), sgst: t - Math.floor(t / 2), igst: 0 };
  } else if (taxableIn !== undefined) {
    taxable = taxableIn!;
    tax = { cgst: 0, sgst: 0, igst: 0 };
  } else return { ok: false, error: "Give the taxable value and a GST %, or the tax amounts" };

  if (taxable <= 0) return { ok: false, error: "Taxable value must be more than zero" };
  if (tax.cgst < 0 || tax.sgst < 0 || tax.igst < 0) return { ok: false, error: "Tax cannot be negative" };
  const total = taxable + tax.cgst + tax.sgst + tax.igst;
  if (totalIn !== undefined && Math.abs(totalIn! - total) > 100) return { ok: false, error: `Total ₹${(totalIn! / 100).toFixed(2)} does not match taxable value plus tax (₹${(total / 100).toFixed(2)})` };

  const k = norm(get("kind"));
  const kind: PurchaseKind | null = !k || /good|stock|material|purchase/.test(k) ? "GOODS" : /service|expense|rent|repair/.test(k) ? "SERVICES" : /capital|machine|equip|asset/.test(k) ? "CAPITAL" : null;
  if (!kind) return { ok: false, error: `Type "${get("kind")}" should be goods, services or capital` };
  const itcText = get("itc");
  // No GSTIN on the bill means no credit can be claimed.
  const itcEligible = no(itcText) ? false : gstinRaw ? true : yes(itcText) ? true : false;

  return { ok: true, value: { supplierName: supplierName.slice(0, 120), supplierGstin: gstinRaw || null, number: number.slice(0, 40), date, stateCode, taxablePaise: taxable, tax, totalPaise: total, kind, itcEligible, note: get("note").trim().slice(0, 200) || null } };
}

export const PURCHASE_FIELDS: { key: string; label: string; required?: boolean; aliases: string[] }[] = [
  { key: "supplier", label: "Supplier name", required: true, aliases: ["supplier", "supplier name", "party", "vendor", "name", "particulars"] },
  { key: "gstin", label: "Supplier GSTIN", aliases: ["gstin", "supplier gstin", "gst no", "gstin/uin"] },
  { key: "number", label: "Bill number", required: true, aliases: ["bill no", "bill number", "invoice no", "invoice number", "number", "voucher no", "ref no"] },
  { key: "date", label: "Bill date", required: true, aliases: ["date", "bill date", "invoice date"] },
  { key: "state", label: "Supplier state", aliases: ["state", "place of supply", "state code"] },
  { key: "taxable", label: "Taxable value", aliases: ["taxable", "taxable value", "taxable amount", "basic", "amount before tax"] },
  { key: "gst", label: "GST %", aliases: ["gst", "gst %", "gst rate", "tax rate", "rate"] },
  { key: "cgst", label: "CGST", aliases: ["cgst", "cgst amount"] },
  { key: "sgst", label: "SGST", aliases: ["sgst", "sgst amount"] },
  { key: "igst", label: "IGST", aliases: ["igst", "igst amount"] },
  { key: "total", label: "Total", aliases: ["total", "total amount", "invoice value", "invoice total", "gross total"] },
  { key: "kind", label: "Type (goods / services / capital)", aliases: ["type", "kind", "category", "nature"] },
  { key: "itc", label: "ITC eligible (yes / no)", aliases: ["itc", "itc eligible", "input credit"] },
  { key: "note", label: "Note", aliases: ["note", "remarks", "narration"] },
];
