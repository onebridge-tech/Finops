import type { Direction } from "./bank-import";

// Putting a transaction in a group (Rent, Salaries...). The app guesses from the words in the description,
// the shop can correct any guess, and a correction is remembered as a rule for the same payee.

export type Category = { name: string; direction: Direction; kind: "income" | "spend" | "transfer"; expense?: string };

export const CATEGORIES: Category[] = [
  { name: "Customer payments", direction: "IN", kind: "income" },
  { name: "Refund received", direction: "IN", kind: "income" },
  { name: "Other income", direction: "IN", kind: "income" },
  { name: "Cash deposited", direction: "IN", kind: "transfer" },
  { name: "Money put in by owner / loan received", direction: "IN", kind: "transfer" },

  { name: "Stock & supplier payments", direction: "OUT", kind: "spend", expense: "Other" },
  { name: "Rent", direction: "OUT", kind: "spend", expense: "Rent" },
  { name: "Salaries & wages", direction: "OUT", kind: "spend", expense: "Salaries" },
  { name: "Electricity & water", direction: "OUT", kind: "spend", expense: "Electricity" },
  { name: "Transport & fuel", direction: "OUT", kind: "spend", expense: "Transport" },
  { name: "Tea, food & snacks", direction: "OUT", kind: "spend", expense: "Tea & snacks" },
  { name: "Marketing & ads", direction: "OUT", kind: "spend", expense: "Marketing" },
  { name: "Phone & internet", direction: "OUT", kind: "spend", expense: "Office supplies" },
  { name: "Repairs & maintenance", direction: "OUT", kind: "spend", expense: "Repairs" },
  { name: "Packaging", direction: "OUT", kind: "spend", expense: "Packaging" },
  { name: "Bank charges & interest", direction: "OUT", kind: "spend", expense: "Other" },
  { name: "Loan EMI", direction: "OUT", kind: "spend", expense: "Other" },
  { name: "Taxes (GST, income tax)", direction: "OUT", kind: "spend", expense: "Other" },
  { name: "Insurance", direction: "OUT", kind: "spend", expense: "Other" },
  { name: "Other spending", direction: "OUT", kind: "spend", expense: "Other" },
  { name: "Cash withdrawn", direction: "OUT", kind: "transfer" },
  { name: "Owner’s own use", direction: "OUT", kind: "transfer" },
];

const byName = new Map(CATEGORIES.map((c) => [c.name, c]));
export const categoryInfo = (name: string): Category | undefined => byName.get(name);
export const categoriesFor = (d: Direction) => CATEGORIES.filter((c) => c.direction === d);
export const DEFAULT_CATEGORY: Record<Direction, string> = { IN: "Customer payments", OUT: "Other spending" };

// Checked in order; the first that matches wins. Words are matched inside the description, ignoring capitals.
const RULES: { re: RegExp; category: string; direction?: Direction }[] = [
  { re: /\b(atm|cash\s*(wdl|withdrawal)|self\s*(chq|cheque)|cwdr)\b/i, category: "Cash withdrawn", direction: "OUT" },
  { re: /\b(cash\s*(dep|deposit)|cdm|cash\s*deposit)\b/i, category: "Cash deposited", direction: "IN" },
  { re: /\b(gst|cgst|sgst|igst|gstn|cbdt|income\s*tax|tds|advance\s*tax|challan|epayment|professional\s*tax)\b/i, category: "Taxes (GST, income tax)", direction: "OUT" },
  { re: /\b(emi|loan|nach.*(loan|finance)|bajaj\s*fin|hdfc\s*ltd|lic\s*hfl|mudra)\b/i, category: "Loan EMI", direction: "OUT" },
  { re: /\b(sms\s*(chg|charges?)|amc|annual\s*fee|service\s*(chg|charge)|processing\s*fee|min\s*bal|penalty|gst\s*on\s*charges|int\.?\s*(debit|pd)|interest\s*(debit|paid|charged))\b/i, category: "Bank charges & interest", direction: "OUT" },
  { re: /\b(rent|landlord|lease)\b/i, category: "Rent", direction: "OUT" },
  { re: /\b(salary|salaries|wages?|payroll|stipend|bonus)\b/i, category: "Salaries & wages", direction: "OUT" },
  { re: /\b(electricity|bescom|tsspdcl|apspdcl|tgspdcl|apepdcl|tneb|tangedco|kseb|bses|power\s*bill|water\s*(bill|board)|hmwssb)\b/i, category: "Electricity & water", direction: "OUT" },
  { re: /\b(petrol|diesel|fuel|hpcl|iocl|bpcl|indian\s*oil|bharat\s*petroleum|hindustan\s*petroleum|shell|fastag|toll|ola|uber|rapido|redbus|irctc|transport|logistics|courier|delhivery|dtdc|blue\s*dart)\b/i, category: "Transport & fuel", direction: "OUT" },
  { re: /\b(swiggy|zomato|tea|chai|snacks?|restaurant|hotel|canteen|bakery|milk|biscuit|juice)\b/i, category: "Tea, food & snacks", direction: "OUT" },
  { re: /\b(google\s*ads?|facebook|meta\s*ads?|instagram|advert|marketing|printing|flex|banner|pamphlet|justdial|indiamart)\b/i, category: "Marketing & ads", direction: "OUT" },
  { re: /\b(airtel|jio|vodafone|vi\s*prepaid|bsnl|broadband|recharge|act\s*fibernet|internet|mobile\s*bill|postpaid)\b/i, category: "Phone & internet", direction: "OUT" },
  { re: /\b(repair|service\s*centre|maintenance|plumber|electrician|carpenter|mechanic|hardware)\b/i, category: "Repairs & maintenance", direction: "OUT" },
  { re: /\b(packing|packaging|carry\s*bag|poly\s*bag|cartons?|pouch)\b/i, category: "Packaging", direction: "OUT" },
  { re: /\b(insurance|lic\b|premium|policybazaar|star\s*health|hdfc\s*ergo|new\s*india\s*assurance)\b/i, category: "Insurance", direction: "OUT" },
  { re: /\b(refund|reversal|rev\s*trf|cashback|chargeback)\b/i, category: "Refund received", direction: "IN" },
  { re: /\b(own\s*account|self\s*transfer|drawings?|personal\s*use|to\s*self)\b/i, category: "Owner’s own use", direction: "OUT" },
  { re: /\b(capital|owner\s*(intro|deposit)|loan\s*(disb|credit)|disbursement|investment|fd\s*(maturity|closure))\b/i, category: "Money put in by owner / loan received", direction: "IN" },
  { re: /\b(wholesale|traders?|distributors?|agencies|agency|suppliers?|enterprises|stores?|mart|purchase|stock|goods|goods\s*purchase|invoice|inv\s*no)\b/i, category: "Stock & supplier payments", direction: "OUT" },
];

export type Rule = { keyword: string; category: string; direction?: string | null };

/** The group for a transaction: the shop's own rules first (they are corrections), then the built-in guesses. */
export function categorize(description: string, direction: Direction, custom: Rule[] = []): string {
  const d = description.toLowerCase();
  for (const r of custom) {
    if ((!r.direction || r.direction === direction) && d.includes(r.keyword.toLowerCase()) && categoryInfo(r.category)?.direction === direction) return r.category;
  }
  for (const r of RULES) if ((!r.direction || r.direction === direction) && r.re.test(description)) return r.category;
  return DEFAULT_CATEGORY[direction];
}

/** Does this group count as money earned, money spent, or just money moved around? */
export const kindOf = (category: string): "income" | "spend" | "transfer" => categoryInfo(category)?.kind ?? "spend";
