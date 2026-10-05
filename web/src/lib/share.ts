import { toRupeeString, type Paise } from "./money";

const VPA = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9.-]{1,64}$/;

export function isValidUpiId(v: string): boolean {
  return VPA.test(v.trim());
}

/** UPI deep link (NPCI intent). Amount is optional for a static counter QR. */
export function upiLink(opts: { vpa: string; payee: string; amountPaise?: Paise; note?: string }): string {
  const p = new URLSearchParams({ pa: opts.vpa, pn: opts.payee, cu: "INR" });
  if (opts.amountPaise && opts.amountPaise > 0) p.set("am", toRupeeString(opts.amountPaise));
  if (opts.note) p.set("tn", opts.note.slice(0, 80));
  return `upi://pay?${p.toString().replace(/\+/g, "%20")}`;
}

/** Indian mobile to E.164 digits without '+', e.g. "98480 12345" → "919848012345". */
export function normalizeIndianMobile(input: string): string | null {
  const d = input.replace(/\D/g, "");
  if (/^[6-9]\d{9}$/.test(d)) return `91${d}`;
  if (/^91[6-9]\d{9}$/.test(d)) return d;
  if (/^0[6-9]\d{9}$/.test(d)) return `91${d.slice(1)}`;
  return null;
}

export function whatsappLink(phone: string, text: string): string | null {
  const n = normalizeIndianMobile(phone);
  return n ? `https://wa.me/${n}?text=${encodeURIComponent(text)}` : null;
}

export function appUrl(path: string): string {
  const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${base}${path}`;
}
