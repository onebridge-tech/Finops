// Spreadsheet imports beyond customers and items: supplier bills, expenses, payments, old sales bills, stock counts,
// cash sales and special prices. The checks are pure (no database) so they are unit-tested; the saving is in import-commit.ts.
import { parseRupees } from "./money";
import { GST_RATES_BP } from "./gst";
import { PURCHASE_FIELDS, isoDate, readTaxColumns, isInterStateBill, type Checked, type Tax } from "./purchase";
import { isValidGstin, normalizeGstin, STATES } from "./gstin";
import { PAYMENT_MODES } from "./format";

export type MoreKind = "purchases" | "expenses" | "payments" | "invoices" | "stock" | "cashsales" | "pricelists";
type Field = { key: string; label: string; required?: boolean; aliases: string[] };

export const MORE_FIELDS: Record<MoreKind, Field[]> = {
  purchases: PURCHASE_FIELDS,
  expenses: [
    { key: "date", label: "Date", required: true, aliases: ["date", "expense date", "paid on"] },
    { key: "amount", label: "Amount", required: true, aliases: ["amount", "expense", "paid", "debit", "value"] },
    { key: "category", label: "Category", aliases: ["category", "head", "expense head", "type", "ledger"] },
    { key: "mode", label: "Paid by", aliases: ["paid by", "mode", "payment mode", "method"] },
    { key: "supplier", label: "Supplier", aliases: ["supplier", "vendor", "paid to", "party"] },
    { key: "note", label: "Note", aliases: ["note", "narration", "remarks", "description"] },
  ],
  payments: [
    { key: "date", label: "Date", required: true, aliases: ["date", "payment date", "voucher date"] },
    { key: "party", label: "Customer / supplier name", required: true, aliases: ["party", "name", "customer", "customer name", "supplier", "particulars", "ledger"] },
    { key: "got", label: "Money received (you got)", aliases: ["got", "received", "you got", "credit", "receipt", "amount received"] },
    { key: "gave", label: "Credit given (you gave)", aliases: ["gave", "you gave", "debit", "given", "credit given", "sale on credit"] },
    { key: "mode", label: "Paid by", aliases: ["paid by", "mode", "payment mode", "method"] },
    { key: "note", label: "Note", aliases: ["note", "narration", "remarks", "description"] },
  ],
  invoices: [
    { key: "number", label: "Bill number", required: true, aliases: ["bill no", "bill number", "invoice no", "invoice number", "number", "voucher no"] },
    { key: "date", label: "Bill date", required: true, aliases: ["date", "bill date", "invoice date"] },
    { key: "party", label: "Customer name", required: true, aliases: ["customer", "customer name", "party", "name", "buyer", "particulars"] },
    { key: "gstin", label: "Customer GSTIN", aliases: ["gstin", "customer gstin", "buyer gstin", "gst no", "gstin/uin"] },
    { key: "state", label: "Place of supply", aliases: ["state", "place of supply", "state code"] },
    { key: "taxable", label: "Taxable value", aliases: ["taxable", "taxable value", "taxable amount", "basic", "amount before tax"] },
    { key: "gst", label: "GST %", aliases: ["gst", "gst %", "gst rate", "tax rate", "rate"] },
    { key: "cgst", label: "CGST", aliases: ["cgst", "cgst amount"] },
    { key: "sgst", label: "SGST", aliases: ["sgst", "sgst amount"] },
    { key: "igst", label: "IGST", aliases: ["igst", "igst amount"] },
    { key: "total", label: "Total", aliases: ["total", "total amount", "invoice value", "invoice total", "gross total"] },
    { key: "hsn", label: "HSN/SAC", aliases: ["hsn", "hsn/sac", "hsn code", "sac"] },
  ],
  stock: [
    { key: "item", label: "Item name", required: true, aliases: ["item", "item name", "name", "product", "stock item"] },
    { key: "qty", label: "Quantity", required: true, aliases: ["quantity", "qty", "stock", "closing stock", "count", "on hand", "opening stock"] },
    { key: "note", label: "Note", aliases: ["note", "remarks", "reason"] },
  ],
  cashsales: [
    { key: "date", label: "Date", required: true, aliases: ["date", "sale date"] },
    { key: "item", label: "Item", required: true, aliases: ["item", "particulars", "description", "product", "sold"] },
    { key: "amount", label: "Amount", required: true, aliases: ["amount", "total", "value", "price"] },
    { key: "qty", label: "Quantity", aliases: ["quantity", "qty", "nos"] },
    { key: "mode", label: "Paid by", aliases: ["paid by", "mode", "payment mode"] },
  ],
  pricelists: [
    { key: "list", label: "Price list name", required: true, aliases: ["list", "price list", "list name", "group", "customer type"] },
    { key: "item", label: "Item name", required: true, aliases: ["item", "item name", "product", "name"] },
    { key: "rate", label: "Rate", required: true, aliases: ["rate", "price", "special price", "selling price"] },
    { key: "minQty", label: "From quantity", aliases: ["from quantity", "min qty", "minimum quantity", "qty from", "slab"] },
  ],
};

/** What each import is called, who may do it, and a sample row for the downloadable template. */
export const MORE_KINDS: Record<MoreKind, { label: string; noun: string; permission: "invoice:write" | "ledger:write" | "stock:write" | "item:write" | "cash:manage"; about: string; example: string[][] }> = {
  purchases: { label: "Supplier bills", noun: "supplier bills", permission: "invoice:write", about: "Bills from suppliers, with their GST, so your input tax credit and GST return are complete. Needs the supplier name, bill number, date and amounts.", example: [["Supplier", "Supplier GSTIN", "Bill no", "Date", "Taxable value", "GST %", "Type", "ITC eligible"], ["Sri Sai Wholesale", "36AAACB1234C1ZG", "B-101", "2026-10-05", "10000", "18", "goods", "yes"]] },
  expenses: { label: "Shop expenses", noun: "expenses", permission: "ledger:write", about: "Rent, salaries, transport and so on, with the date and amount. Entries that are already in the app are skipped.", example: [["Date", "Amount", "Category", "Paid by", "Supplier", "Note"], ["2026-10-01", "12000", "Rent", "bank", "", "October rent"]] },
  payments: { label: "Payments & credit", noun: "entries", permission: "ledger:write", about: "Money received from customers (or credit given), by customer name. Customers must already be in the app. Put the amount in “Got” for a payment and in “Gave” for credit.", example: [["Date", "Customer", "Got", "Gave", "Paid by", "Note"], ["2026-10-03", "Ravi Tea Traders", "2000", "", "upi", "Part payment"], ["2026-10-04", "Lakshmi General Stores", "", "5400", "", "Goods on credit"]] },
  invoices: { label: "Old sales bills", noun: "bills", permission: "invoice:write", about: "Bills you made before using this app, so your GST returns and year-end reports include them. Customers that are not in the app yet are added.", example: [["Bill no", "Date", "Customer", "Customer GSTIN", "Taxable value", "GST %", "HSN"], ["OLD-1", "2026-06-12", "Lakshmi General Stores", "", "8000", "5", "0902"]] },
  stock: { label: "Stock counts", noun: "stock counts", permission: "stock:write", about: "How much of each item you have. Items you do not track yet start being tracked.", example: [["Item", "Quantity", "Note"], ["Tea Powder", "25", "Count on 1 Oct"]] },
  cashsales: { label: "Cash sales (no name)", noun: "cash sales", permission: "ledger:write", about: "Sales you wrote down without a customer name, such as from a paper note.", example: [["Date", "Item", "Quantity", "Amount", "Paid by"], ["2026-10-06", "Tea 2 cups", "2", "30", "cash"]] },
  pricelists: { label: "Special prices", noun: "special prices", permission: "item:write", about: "A rate for an item in a price list, optionally from a quantity. Lists that do not exist are created; items must already be in the app.", example: [["Price list", "Item", "Rate", "From quantity"], ["Dealer", "Tea Powder", "380", "0"], ["Dealer", "Tea Powder", "360", "50"]] },
};

const norm = (s: string) => s.toLowerCase().replace(/\(.*?\)/g, " ").replace(/[₹%_.]+/g, " ").replace(/\s+/g, " ").trim();

export function parseMode(v: string): (typeof PAYMENT_MODES)[number] | null | undefined {
  const t = norm(v);
  if (!t) return undefined;
  if (/^cash/.test(t)) return "CASH";
  if (/^(upi|gpay|google pay|phonepe|paytm|bhim)/.test(t)) return "UPI";
  if (/^(bank|neft|imps|rtgs|transfer|online)/.test(t)) return "BANK";
  if (/^(cheque|check|dd)/.test(t)) return "CHEQUE";
  if (/^(card|credit card|debit card)/.test(t)) return "CARD";
  if (/^other/.test(t)) return "OTHER";
  return null;
}

const todayYmd = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
const dateOf = (v: string, label = "Date"): Checked<string> => {
  const d = isoDate(v);
  if (!d) return { ok: false, error: `${label} "${v}" is not a date` };
  if (d > todayYmd()) return { ok: false, error: `${label} is in the future` };
  return { ok: true, value: d };
};
const amountOf = (v: string, label: string): Checked<number> => {
  const p = parseRupees(v.trim());
  return p === null || p <= 0 ? { ok: false, error: `${label} "${v}" should be an amount more than zero` } : { ok: true, value: p };
};

export type ExpenseImport = { date: string; amountPaise: number; category: string; mode: (typeof PAYMENT_MODES)[number]; supplier: string | null; note: string | null };
export function checkExpenseRow(get: (k: string) => string): Checked<ExpenseImport> {
  const d = dateOf(get("date")); if (!d.ok) return d;
  const a = amountOf(get("amount"), "Amount"); if (!a.ok) return a;
  const mode = parseMode(get("mode"));
  if (mode === null) return { ok: false, error: `Paid by "${get("mode")}" should be cash, UPI, bank, cheque or card` };
  return { ok: true, value: { date: d.value, amountPaise: a.value, category: get("category").trim().slice(0, 40) || "Other", mode: mode ?? "CASH", supplier: get("supplier").trim() || null, note: get("note").trim().slice(0, 200) || null } };
}

export type PaymentImport = { date: string; party: string; direction: "GOT" | "GAVE"; amountPaise: number; mode: (typeof PAYMENT_MODES)[number] | null; note: string | null };
export function checkPaymentRow(get: (k: string) => string): Checked<PaymentImport> {
  const party = get("party").trim();
  if (!party) return { ok: false, error: "Customer name is missing" };
  const d = dateOf(get("date")); if (!d.ok) return d;
  const got = get("got").trim() ? parseRupees(get("got").trim()) : 0;
  const gave = get("gave").trim() ? parseRupees(get("gave").trim()) : 0;
  if (got === null || gave === null) return { ok: false, error: "Amounts should be numbers like 1500 or 1500.50" };
  if ((got > 0) === (gave > 0)) return { ok: false, error: "Put the amount in either “Got” or “Gave”, not both or neither" };
  const mode = parseMode(get("mode"));
  if (mode === null) return { ok: false, error: `Paid by "${get("mode")}" should be cash, UPI, bank, cheque or card` };
  return { ok: true, value: { date: d.value, party, direction: got > 0 ? "GOT" : "GAVE", amountPaise: got > 0 ? got : gave, mode: got > 0 ? mode ?? "CASH" : null, note: get("note").trim().slice(0, 200) || null } };
}

export type InvoiceImport = { number: string; date: string; party: string; gstin: string | null; stateCode: string; taxablePaise: number; tax: Tax; totalPaise: number; rateBp: number; hsn: string | null };
export function checkInvoiceRow(get: (k: string) => string, businessState: string): Checked<InvoiceImport> {
  const number = get("number").trim();
  if (!number) return { ok: false, error: "Bill number is missing" };
  const party = get("party").trim();
  if (!party) return { ok: false, error: "Customer name is missing" };
  const d = dateOf(get("date"), "Bill date"); if (!d.ok) return d;
  const gstin = normalizeGstin(get("gstin"));
  if (gstin && !isValidGstin(gstin)) return { ok: false, error: `GSTIN "${gstin}" is not valid` };
  const sRaw = get("state").trim();
  const byName = Object.entries(STATES).find(([, n]) => norm(n) === norm(sRaw))?.[0];
  const stateCode = gstin ? gstin.slice(0, 2) : /^\d{1,2}$/.test(sRaw) && sRaw.padStart(2, "0") in STATES ? sRaw.padStart(2, "0") : byName ?? (sRaw ? "" : businessState);
  if (!stateCode) return { ok: false, error: `Unknown state "${sRaw}"` };
  const inter = isInterStateBill(businessState, stateCode);
  const cols = readTaxColumns(get, inter); if (!cols.ok) return cols;
  const { taxable, tax, total } = cols.value;
  const taxSum = tax.cgst + tax.sgst + tax.igst;
  // The bill's GST rate: as typed, or worked out from the tax amounts and snapped to a real rate.
  const typed = get("gst").trim() ? Math.round(Number(get("gst").trim().replace(/%$/, "")) * 100) : null;
  const rateBp = typed ?? GST_RATES_BP.reduce((best, r) => (Math.abs(r - (taxSum * 10000) / taxable) < Math.abs(best - (taxSum * 10000) / taxable) ? r : best), 0);
  const hsn = get("hsn").trim();
  if (hsn && !/^\d{4,8}$/.test(hsn)) return { ok: false, error: `HSN/SAC "${hsn}" should be 4–8 digits` };
  return { ok: true, value: { number: number.slice(0, 40), date: d.value, party: party.slice(0, 120), gstin: gstin || null, stateCode, taxablePaise: taxable, tax, totalPaise: total, rateBp, hsn: hsn || null } };
}

export type StockImport = { item: string; qtyMilli: number; note: string | null };
export function checkStockRow(get: (k: string) => string): Checked<StockImport> {
  const item = get("item").trim();
  if (!item) return { ok: false, error: "Item name is missing" };
  const q = get("qty").trim().replace(/,/g, "");
  const n = Number(q);
  if (!q || !Number.isFinite(n) || Math.abs(n) > 10_000_000) return { ok: false, error: `Quantity "${get("qty")}" is not a number` };
  return { ok: true, value: { item, qtyMilli: Math.round(n * 1000), note: get("note").trim().slice(0, 120) || null } };
}

export type CashSaleImport = { date: string; item: string; qtyMilli: number | null; amountPaise: number; mode: (typeof PAYMENT_MODES)[number] };
export function checkCashSaleRow(get: (k: string) => string): Checked<CashSaleImport> {
  const d = dateOf(get("date")); if (!d.ok) return d;
  const item = get("item").trim();
  if (!item) return { ok: false, error: "Item is missing" };
  const a = amountOf(get("amount"), "Amount"); if (!a.ok) return a;
  const qtyText = get("qty").trim();
  const qty = qtyText ? Number(qtyText) : null;
  if (qty !== null && !Number.isFinite(qty)) return { ok: false, error: `Quantity "${qtyText}" is not a number` };
  const mode = parseMode(get("mode"));
  if (mode === null) return { ok: false, error: `Paid by "${get("mode")}" should be cash, UPI, bank, cheque or card` };
  return { ok: true, value: { date: d.value, item: item.slice(0, 120), qtyMilli: qty === null ? null : Math.round(qty * 1000), amountPaise: a.value, mode: mode ?? "CASH" } };
}

export type PriceImport = { list: string; item: string; ratePaise: number; minQtyMilli: number };
export function checkPriceRow(get: (k: string) => string): Checked<PriceImport> {
  const list = get("list").trim();
  const item = get("item").trim();
  if (!list) return { ok: false, error: "Price list name is missing" };
  if (!item) return { ok: false, error: "Item name is missing" };
  const rate = parseRupees(get("rate").trim());
  if (rate === null || rate <= 0) return { ok: false, error: `Rate "${get("rate")}" is not an amount` };
  const mq = get("minQty").trim();
  const minQty = mq ? Number(mq) : 0;
  if (!Number.isFinite(minQty) || minQty < 0) return { ok: false, error: `From quantity "${mq}" is not a number` };
  return { ok: true, value: { list: list.slice(0, 60), item, ratePaise: rate, minQtyMilli: Math.round(minQty * 1000) } };
}
