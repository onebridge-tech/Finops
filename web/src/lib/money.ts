// All money is integer paise. These helpers are the only place rupee <-> paise
// conversion happens.

export type Paise = number;

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2 });

export function formatINR(paise: Paise | bigint): string {
  return inr.format(Number(paise) / 100);
}

/** Parse user input like "1,250.5" or "₹ 99" into paise. Returns null if invalid. */
export function parseRupees(input: string): Paise | null {
  const cleaned = input.replace(/[₹,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const [whole, frac = ""] = cleaned.split(".");
  const paise = Number(whole) * 100 + Number(frac.padEnd(2, "0"));
  return Number.isSafeInteger(paise) ? paise : null;
}

/** Rupees with exactly two decimals, e.g. for UPI `am=` parameter. */
export function toRupeeString(paise: Paise): string {
  const sign = paise < 0 ? "-" : "";
  const abs = Math.abs(paise);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

/** Round half away from zero to an integer. */
export function roundHalfUp(n: number): number {
  return Math.sign(n) * Math.round(Math.abs(n));
}
