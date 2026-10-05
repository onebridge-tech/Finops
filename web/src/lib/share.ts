import { formatINR, toRupeeString, type Paise } from "./money";

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

export const REMINDER_LANGUAGES: Record<string, string> = { en: "English", hi: "हिन्दी", te: "తెలుగు" };

export function reminderText(lang: string, v: { party: string; business: string; amountPaise: Paise; link: string }): string {
  const amt = formatINR(v.amountPaise);
  switch (lang) {
    case "hi":
      return `नमस्ते ${v.party}, ${v.business} की ओर से विनम्र अनुस्मारक: ${amt} बकाया है। विवरण देखें और भुगतान करें: ${v.link}`;
    case "te":
      return `నమస్తే ${v.party}, ${v.business} నుండి గుర్తు: ${amt} బాకీ ఉంది. వివరాలు చూసి చెల్లించండి: ${v.link}`;
    default:
      return `Hello ${v.party}, a friendly reminder from ${v.business}: ${amt} is due. View your statement and pay here: ${v.link}`;
  }
}

export function appUrl(path: string): string {
  const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${base}${path}`;
}
