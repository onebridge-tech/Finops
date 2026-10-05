// Validation of imported spreadsheet rows (LG-07, IN-02). Pure, so it is unit-tested.
import { parseRupees } from "./money";
import { isValidGstin, normalizeGstin, STATES } from "./gstin";
import { normalizeIndianMobile } from "./share";
import { GST_RATES_BP } from "./gst";

export type ImportKind = "parties" | "items";

export const FIELDS: Record<ImportKind, { key: string; label: string; required?: boolean; aliases: string[] }[]> = {
  parties: [
    { key: "name", label: "Name", required: true, aliases: ["name", "party", "party name", "customer", "customer name", "ledger", "ledger name"] },
    { key: "phone", label: "Mobile", aliases: ["phone", "mobile", "mobile no", "phone number", "contact", "whatsapp"] },
    { key: "email", label: "Email", aliases: ["email", "e-mail", "email id"] },
    { key: "gstin", label: "GSTIN", aliases: ["gstin", "gst", "gst no", "gstin/uin", "gst number"] },
    { key: "state", label: "State", aliases: ["state", "state code", "place of supply"] },
    { key: "address", label: "Address", aliases: ["address", "city", "location"] },
    { key: "type", label: "Type", aliases: ["type", "party type", "group", "category"] },
    { key: "creditDays", label: "Credit days", aliases: ["credit days", "credit period", "days"] },
    { key: "opening", label: "Opening balance", aliases: ["opening", "opening balance", "balance", "amount", "outstanding", "closing balance"] },
    { key: "openingType", label: "Dr / Cr", aliases: ["dr/cr", "dr cr", "balance type", "type of balance"] },
  ],
  items: [
    { key: "name", label: "Item name", required: true, aliases: ["name", "item", "item name", "product", "stock item", "description"] },
    { key: "price", label: "Sale price", required: true, aliases: ["price", "sale price", "rate", "selling price", "mrp"] },
    { key: "purchasePrice", label: "Purchase price", aliases: ["purchase price", "cost", "cost price", "purchase rate"] },
    { key: "gst", label: "GST %", aliases: ["gst", "gst %", "gst rate", "tax", "tax rate"] },
    { key: "hsn", label: "HSN/SAC", aliases: ["hsn", "hsn/sac", "hsn code", "sac"] },
    { key: "unit", label: "Unit", aliases: ["unit", "uom", "units"] },
    { key: "sku", label: "SKU / code", aliases: ["sku", "code", "item code", "part no"] },
  ],
};

// Header text without case, brackets, ₹ or %: "Sale price (₹)" matches "sale price".
const norm = (s: string) => s.toLowerCase().replace(/\(.*?\)/g, " ").replace(/[₹%_.]+/g, " ").replace(/\s+/g, " ").trim();

/** Best guess of which column holds each field, from the header row. */
export function guessMapping(kind: ImportKind, header: string[]): Record<string, number> {
  const map: Record<string, number> = {};
  const used = new Set<number>();
  for (const f of FIELDS[kind]) {
    const i = header.findIndex((h, idx) => !used.has(idx) && f.aliases.some((a) => norm(a) === norm(h)));
    if (i >= 0) { map[f.key] = i; used.add(i); }
  }
  return map;
}

export type PartyRow = {
  name: string; phone: string | null; email: string | null; gstin: string | null; stateCode: string | null; address: string | null;
  type: "CUSTOMER" | "SUPPLIER" | "BOTH"; creditDays: number | null; openingPaise: number; openingDirection: "GAVE" | "GOT";
};

export type ItemRow = {
  name: string; pricePaise: number; purchasePricePaise: number | null; taxRateBp: number; hsn: string | null; unit: string; sku: string | null;
};

export type Checked<T> = { ok: true; value: T } | { ok: false; error: string };

const stateByName = Object.fromEntries(Object.entries(STATES).map(([code, name]) => [norm(name), code]));

function parseState(v: string): string | null | undefined {
  if (!v) return null;
  const s = v.trim();
  if (/^\d{1,2}$/.test(s)) { const c = s.padStart(2, "0"); return c in STATES ? c : undefined; }
  return stateByName[norm(s)];
}

/** Amount that may carry Dr/Cr or a minus sign, e.g. "1,200.50 Dr", "-500", "(500)". */
function signedAmount(v: string): { paise: number; negative: boolean; drcr: "DR" | "CR" | null } | null {
  let s = v.trim();
  if (!s) return { paise: 0, negative: false, drcr: null };
  let drcr: "DR" | "CR" | null = null;
  const m = s.match(/\s*(dr|cr)\.?$/i);
  if (m) { drcr = m[1].toUpperCase() as "DR" | "CR"; s = s.slice(0, m.index).trim(); }
  let negative = false;
  if (/^\(.*\)$/.test(s)) { negative = true; s = s.slice(1, -1); }
  if (s.startsWith("-")) { negative = true; s = s.slice(1); }
  const paise = parseRupees(s);
  return paise === null ? null : { paise, negative, drcr };
}

export function checkPartyRow(get: (key: string) => string): Checked<PartyRow> {
  const name = get("name").trim();
  if (!name) return { ok: false, error: "Name is missing" };
  if (name.length > 120) return { ok: false, error: "Name is too long" };

  const rawPhone = get("phone").trim();
  const phone = rawPhone ? normalizeIndianMobile(rawPhone) : null;
  if (rawPhone && !phone) return { ok: false, error: `Mobile "${rawPhone}" is not a valid Indian number` };

  const gstin = normalizeGstin(get("gstin"));
  if (gstin && !isValidGstin(gstin)) return { ok: false, error: `GSTIN "${gstin}" is not valid` };

  const state = parseState(get("state"));
  if (state === undefined) return { ok: false, error: `Unknown state "${get("state")}"` };

  const t = norm(get("type"));
  const type = !t || /customer|debtor|buyer|client/.test(t) ? "CUSTOMER" : /supplier|creditor|vendor/.test(t) ? "SUPPLIER" : /both/.test(t) ? "BOTH" : null;
  if (!type) return { ok: false, error: `Type "${get("type")}" should be customer, supplier or both` };

  const cd = get("creditDays").trim();
  if (cd && !/^\d{1,3}$/.test(cd)) return { ok: false, error: `Credit days "${cd}" should be a number` };

  const amt = signedAmount(get("opening"));
  if (!amt) return { ok: false, error: `Opening balance "${get("opening")}" is not an amount` };
  const typeCol = norm(get("openingType"));
  const drcr = amt.drcr ?? (/^(dr|debit|receivable|they owe)/.test(typeCol) ? "DR" : /^(cr|credit|payable|i owe)/.test(typeCol) ? "CR" : null);
  // Dr (debit) balance = the party owes us. A minus sign or Cr means we owe them.
  const owesUs = drcr ? drcr === "DR" : !amt.negative;

  const email = get("email").trim();
  return {
    ok: true,
    value: {
      name, phone, email: email || null, gstin: gstin || null, stateCode: gstin ? gstin.slice(0, 2) : state,
      address: get("address").trim() || null, type, creditDays: cd ? Number(cd) : null,
      openingPaise: amt.paise, openingDirection: owesUs ? "GAVE" : "GOT",
    },
  };
}

export function checkItemRow(get: (key: string) => string): Checked<ItemRow> {
  const name = get("name").trim();
  if (!name) return { ok: false, error: "Item name is missing" };
  const price = parseRupees(get("price"));
  if (price === null) return { ok: false, error: `Sale price "${get("price")}" is not an amount` };
  const pp = get("purchasePrice").trim();
  const purchase = pp ? parseRupees(pp) : null;
  if (pp && purchase === null) return { ok: false, error: `Purchase price "${pp}" is not an amount` };
  const g = get("gst").trim().replace(/%$/, "");
  const bp = g === "" ? 1800 : Math.round(Number(g) * 100);
  if (!GST_RATES_BP.includes(bp)) return { ok: false, error: `GST rate "${get("gst")}" should be one of 0, 0.25, 3, 5, 12, 18, 28` };
  const hsn = get("hsn").trim();
  if (hsn && !/^\d{4,8}$/.test(hsn)) return { ok: false, error: `HSN/SAC "${hsn}" should be 4–8 digits` };
  return {
    ok: true,
    value: { name: name.slice(0, 120), pricePaise: price, purchasePricePaise: purchase, taxRateBp: bp, hsn: hsn || null, unit: get("unit").trim().slice(0, 12) || "pcs", sku: get("sku").trim().slice(0, 40) || null },
  };
}
