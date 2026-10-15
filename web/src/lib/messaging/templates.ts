// Message templates per language. Each one maps to a pre-approved WhatsApp template
// and a DLT-registered SMS template with the same variables, in the same order.
import { formatINR, type Paise } from "../money";

export type MessageKind = "REMINDER" | "ENTRY_GAVE" | "ENTRY_GOT" | "RECEIPT" | "INVOICE" | "QUOTE" | "STATEMENT" | "INVITE";

export type TemplateVars = {
  party: string;
  business: string;
  link: string;
  amountPaise?: Paise;
  balancePaise?: Paise; // positive = party owes the business
  number?: string; // invoice / receipt / quote number
  date?: string;
};

type Lang = { name: string; balance: (p: Paise) => string; optOut: string } & Record<MessageKind, (v: Required<TemplateVars>) => string>;

const amt = formatINR;

const en: Lang = {
  name: "English",
  balance: (p) => (p > 0 ? `${amt(p)} due` : p < 0 ? `${amt(-p)} in your favour` : "settled"),
  optOut: "Stop messages",
  REMINDER: (v) => `Hello ${v.party}, a friendly reminder from ${v.business}: ${amt(v.balancePaise)} is due. View your statement and pay here: ${v.link}`,
  ENTRY_GAVE: (v) => `${v.business} recorded ${amt(v.amountPaise)} on credit to you on ${v.date}. Balance: ${en.balance(v.balancePaise)}. Details: ${v.link}`,
  ENTRY_GOT: (v) => `${v.business} recorded ${amt(v.amountPaise)} received from you on ${v.date}. Balance: ${en.balance(v.balancePaise)}. Details: ${v.link}`,
  RECEIPT: (v) => `Thank you, ${v.party}. ${v.business} received ${amt(v.amountPaise)} on ${v.date} (receipt ${v.number}). View receipt: ${v.link}`,
  INVOICE: (v) => `Invoice ${v.number} from ${v.business} for ${amt(v.amountPaise)}. View and pay: ${v.link}`,
  QUOTE: (v) => `Quotation ${v.number} from ${v.business} for ${amt(v.amountPaise)}. View and accept: ${v.link}`,
  STATEMENT: (v) => `${v.business} has shared your account statement. Balance: ${en.balance(v.balancePaise)}. View: ${v.link}`,
  INVITE: (v) => `${v.business} keeps your account on our ledger app. Keep your own customer ledger and send reminders too — free: ${v.link}`,
};

const hi: Lang = {
  name: "हिन्दी",
  balance: (p) => (p > 0 ? `${amt(p)} बकाया` : p < 0 ? `${amt(-p)} आपके पक्ष में` : "हिसाब बराबर"),
  optOut: "संदेश बंद करें",
  REMINDER: (v) => `नमस्ते ${v.party}, ${v.business} की ओर से विनम्र अनुस्मारक: ${amt(v.balancePaise)} बकाया है। विवरण देखें और भुगतान करें: ${v.link}`,
  ENTRY_GAVE: (v) => `${v.business} ने ${v.date} को आपके खाते में ${amt(v.amountPaise)} उधार दर्ज किया। शेष: ${hi.balance(v.balancePaise)}। विवरण: ${v.link}`,
  ENTRY_GOT: (v) => `${v.business} ने ${v.date} को आपसे ${amt(v.amountPaise)} प्राप्त होना दर्ज किया। शेष: ${hi.balance(v.balancePaise)}। विवरण: ${v.link}`,
  RECEIPT: (v) => `धन्यवाद ${v.party}! ${v.business} को ${v.date} को ${amt(v.amountPaise)} प्राप्त हुए (रसीद ${v.number})। रसीद देखें: ${v.link}`,
  INVOICE: (v) => `${v.business} का बिल ${v.number}, राशि ${amt(v.amountPaise)}। देखें और भुगतान करें: ${v.link}`,
  QUOTE: (v) => `${v.business} का कोटेशन ${v.number}, राशि ${amt(v.amountPaise)}। देखें और स्वीकार करें: ${v.link}`,
  STATEMENT: (v) => `${v.business} ने आपका खाता विवरण भेजा है। शेष: ${hi.balance(v.balancePaise)}। देखें: ${v.link}`,
  INVITE: (v) => `${v.business} आपका खाता हमारे लेजर ऐप पर रखता है। आप भी अपने ग्राहकों का हिसाब मुफ्त रखें और याद दिलाएँ: ${v.link}`,
};

const te: Lang = {
  name: "తెలుగు",
  balance: (p) => (p > 0 ? `${amt(p)} బాకీ` : p < 0 ? `${amt(-p)} మీకు రావాలి` : "లెక్క సరిపోయింది"),
  optOut: "సందేశాలు ఆపండి",
  REMINDER: (v) => `నమస్తే ${v.party}, ${v.business} నుండి గుర్తు: ${amt(v.balancePaise)} బాకీ ఉంది. వివరాలు చూసి చెల్లించండి: ${v.link}`,
  ENTRY_GAVE: (v) => `${v.business} ${v.date}న మీ ఖాతాలో ${amt(v.amountPaise)} అప్పు నమోదు చేసింది. బాకీ: ${te.balance(v.balancePaise)}. వివరాలు: ${v.link}`,
  ENTRY_GOT: (v) => `${v.business} ${v.date}న మీ నుండి ${amt(v.amountPaise)} అందినట్లు నమోదు చేసింది. బాకీ: ${te.balance(v.balancePaise)}. వివరాలు: ${v.link}`,
  RECEIPT: (v) => `ధన్యవాదాలు ${v.party}! ${v.business}కు ${v.date}న ${amt(v.amountPaise)} అందింది (రసీదు ${v.number}). రసీదు: ${v.link}`,
  INVOICE: (v) => `${v.business} నుండి బిల్లు ${v.number}, మొత్తం ${amt(v.amountPaise)}. చూసి చెల్లించండి: ${v.link}`,
  QUOTE: (v) => `${v.business} నుండి కొటేషన్ ${v.number}, మొత్తం ${amt(v.amountPaise)}. చూసి ఆమోదించండి: ${v.link}`,
  STATEMENT: (v) => `${v.business} మీ ఖాతా వివరాలు పంపింది. బాకీ: ${te.balance(v.balancePaise)}. చూడండి: ${v.link}`,
  INVITE: (v) => `${v.business} మీ ఖాతాను మా లెడ్జర్ యాప్‌లో ఉంచుతుంది. మీరు కూడా మీ కస్టమర్ల లెక్క ఉచితంగా ఉంచుకోండి: ${v.link}`,
};

const ta: Lang = {
  name: "தமிழ்",
  balance: (p) => (p > 0 ? `${amt(p)} பாக்கி` : p < 0 ? `${amt(-p)} உங்களுக்கு வர வேண்டும்` : "கணக்கு சரி"),
  optOut: "செய்திகளை நிறுத்த",
  REMINDER: (v) => `வணக்கம் ${v.party}, ${v.business} அன்புடன் நினைவூட்டுகிறது: ${amt(v.balancePaise)} செலுத்த வேண்டியுள்ளது. விவரம் பார்த்து செலுத்த: ${v.link}`,
  ENTRY_GAVE: (v) => `${v.business} ${v.date} அன்று உங்கள் கணக்கில் ${amt(v.amountPaise)} கடன் பதிவு செய்தது. பாக்கி: ${ta.balance(v.balancePaise)}. விவரம்: ${v.link}`,
  ENTRY_GOT: (v) => `${v.business} ${v.date} அன்று உங்களிடமிருந்து ${amt(v.amountPaise)} பெற்றதாக பதிவு செய்தது. பாக்கி: ${ta.balance(v.balancePaise)}. விவரம்: ${v.link}`,
  RECEIPT: (v) => `நன்றி ${v.party}! ${v.business} ${v.date} அன்று ${amt(v.amountPaise)} பெற்றது (ரசீது ${v.number}). ரசீது: ${v.link}`,
  INVOICE: (v) => `${v.business} பில் ${v.number}, தொகை ${amt(v.amountPaise)}. பார்த்து செலுத்த: ${v.link}`,
  QUOTE: (v) => `${v.business} மதிப்பீடு ${v.number}, தொகை ${amt(v.amountPaise)}. பார்த்து ஏற்க: ${v.link}`,
  STATEMENT: (v) => `${v.business} உங்கள் கணக்கு அறிக்கையை அனுப்பியுள்ளது. பாக்கி: ${ta.balance(v.balancePaise)}. பார்க்க: ${v.link}`,
  INVITE: (v) => `${v.business} உங்கள் கணக்கை எங்கள் லெட்ஜர் ஆப்பில் வைத்துள்ளது. உங்கள் சொந்த கணக்கையும் இலவசமாக வைத்துக்கொள்ளுங்கள்: ${v.link}`,
};

const kn: Lang = {
  name: "ಕನ್ನಡ",
  balance: (p) => (p > 0 ? `${amt(p)} ಬಾಕಿ` : p < 0 ? `${amt(-p)} ನಿಮಗೆ ಬರಬೇಕು` : "ಲೆಕ್ಕ ಸರಿ"),
  optOut: "ಸಂದೇಶ ನಿಲ್ಲಿಸಲು",
  REMINDER: (v) => `ನಮಸ್ಕಾರ ${v.party}, ${v.business} ಇಂದ ನೆನಪು: ${amt(v.balancePaise)} ಬಾಕಿ ಇದೆ. ವಿವರ ನೋಡಿ ಪಾವತಿಸಿ: ${v.link}`,
  ENTRY_GAVE: (v) => `${v.business} ${v.date} ರಂದು ನಿಮ್ಮ ಖಾತೆಗೆ ${amt(v.amountPaise)} ಸಾಲ ದಾಖಲಿಸಿದೆ. ಬಾಕಿ: ${kn.balance(v.balancePaise)}. ವಿವರ: ${v.link}`,
  ENTRY_GOT: (v) => `${v.business} ${v.date} ರಂದು ನಿಮ್ಮಿಂದ ${amt(v.amountPaise)} ಬಂದಿದೆ ಎಂದು ದಾಖಲಿಸಿದೆ. ಬಾಕಿ: ${kn.balance(v.balancePaise)}. ವಿವರ: ${v.link}`,
  RECEIPT: (v) => `ಧನ್ಯವಾದ ${v.party}! ${v.business}ಗೆ ${v.date} ರಂದು ${amt(v.amountPaise)} ಬಂದಿದೆ (ರಸೀದಿ ${v.number}). ರಸೀದಿ: ${v.link}`,
  INVOICE: (v) => `${v.business} ಬಿಲ್ ${v.number}, ಮೊತ್ತ ${amt(v.amountPaise)}. ನೋಡಿ ಪಾವತಿಸಿ: ${v.link}`,
  QUOTE: (v) => `${v.business} ಕೊಟೇಶನ್ ${v.number}, ಮೊತ್ತ ${amt(v.amountPaise)}. ನೋಡಿ ಒಪ್ಪಿಕೊಳ್ಳಿ: ${v.link}`,
  STATEMENT: (v) => `${v.business} ನಿಮ್ಮ ಖಾತೆ ವಿವರ ಕಳುಹಿಸಿದೆ. ಬಾಕಿ: ${kn.balance(v.balancePaise)}. ನೋಡಿ: ${v.link}`,
  INVITE: (v) => `${v.business} ನಿಮ್ಮ ಖಾತೆಯನ್ನು ನಮ್ಮ ಲೆಡ್ಜರ್ ಆ್ಯಪ್‌ನಲ್ಲಿ ಇಟ್ಟಿದೆ. ನಿಮ್ಮ ಸ್ವಂತ ಲೆಕ್ಕವನ್ನೂ ಉಚಿತವಾಗಿ ಇಡಿ: ${v.link}`,
};

// Message templates must be registered with WhatsApp / DLT in every language listed here.
export const LANGUAGES: Record<string, Lang> = { en, hi, te, ta, kn };

export const LANGUAGE_NAMES: Record<string, string> = Object.fromEntries(Object.entries(LANGUAGES).map(([k, l]) => [k, l.name]));

export function renderMessage(kind: MessageKind, lang: string, v: TemplateVars, optOutUrl?: string): string {
  const l = LANGUAGES[lang] ?? en;
  const full: Required<TemplateVars> = { amountPaise: 0, balancePaise: 0, number: "", date: "", ...v };
  const body = l[kind](full);
  return optOutUrl ? `${body}\n${l.optOut}: ${optOutUrl}` : body;
}

/** Variables in template order, for providers that take positional parameters. */
export function templateParams(kind: MessageKind, v: TemplateVars): string[] {
  const a = v.amountPaise !== undefined ? amt(v.amountPaise) : "";
  const b = v.balancePaise !== undefined ? amt(v.balancePaise) : "";
  switch (kind) {
    case "REMINDER": return [v.party, v.business, b, v.link];
    case "ENTRY_GAVE":
    case "ENTRY_GOT": return [v.business, a, v.date ?? "", b, v.link];
    case "RECEIPT": return [v.party, v.business, a, v.date ?? "", v.number ?? "", v.link];
    case "INVOICE":
    case "QUOTE": return [v.number ?? "", v.business, a, v.link];
    case "STATEMENT": return [v.business, b, v.link];
    case "INVITE": return [v.business, v.link];
  }
}

// ── Editable templates ───────────────────────────────────────────────────────
// A shop can change the wording of any message. The text holds {placeholders} that are filled in per customer.

export const TEMPLATE_KINDS: { kind: MessageKind; label: string; about: string }[] = [
  { kind: "REMINDER", label: "Payment reminder", about: "Asking a customer to pay what is pending" },
  { kind: "ENTRY_GAVE", label: "Credit given", about: "Confirming goods or credit you gave" },
  { kind: "ENTRY_GOT", label: "Payment received (entry)", about: "Confirming a payment you wrote down" },
  { kind: "RECEIPT", label: "Receipt", about: "Thanking them for a payment" },
  { kind: "INVOICE", label: "Bill", about: "Sending a bill with a link to pay" },
  { kind: "QUOTE", label: "Price quote", about: "Sending a price quote" },
  { kind: "STATEMENT", label: "Account statement", about: "Sharing their account" },
  { kind: "INVITE", label: "Invitation", about: "Inviting them to keep their own account" },
];

export const TEMPLATE_TOKENS: { token: string; about: string }[] = [
  { token: "party", about: "Customer name" },
  { token: "business", about: "Your shop name" },
  { token: "amount", about: "The amount of this bill, receipt or entry" },
  { token: "balance", about: "Their total pending amount" },
  { token: "balanceText", about: "Pending amount in words, e.g. “₹500 due”" },
  { token: "date", about: "The date" },
  { token: "number", about: "Bill, receipt or quote number" },
  { token: "link", about: "The link they open" },
];
const KNOWN = new Set(TEMPLATE_TOKENS.map((t) => t.token));

/** The built-in wording as editable text with {placeholders}. */
export function defaultTemplateText(kind: MessageKind, lang: string): string {
  const l = LANGUAGES[lang] ?? en;
  const A = 111_111_111, B = 222_222_222;
  const text = l[kind]({ party: "{party}", business: "{business}", link: "{link}", number: "{number}", date: "{date}", amountPaise: A, balancePaise: B });
  return text.split(l.balance(B)).join("{balanceText}").split(amt(B)).join("{balance}").split(amt(A)).join("{amount}");
}

/** Why this wording can't be saved, or null. */
export function checkTemplate(text: string): string | null {
  const t = text.trim();
  if (t.length < 10) return "Write a few more words.";
  if (t.length > 900) return "Keep it under 900 characters so it fits one WhatsApp message.";
  for (const m of t.matchAll(/\{([^{}]*)\}/g)) if (!KNOWN.has(m[1]!)) return `“{${m[1]}}” is not a known placeholder.`;
  if (!t.includes("{link}")) return "Include {link} so the customer can open it.";
  return null;
}

/** Fills the placeholders in a shop's own wording. */
export function fillTemplate(text: string, lang: string, v: TemplateVars): string {
  const l = LANGUAGES[lang] ?? en;
  const values: Record<string, string> = {
    party: v.party, business: v.business, link: v.link, number: v.number ?? "", date: v.date ?? "",
    amount: amt(v.amountPaise ?? 0), balance: amt(Math.abs(v.balancePaise ?? 0)), balanceText: l.balance(v.balancePaise ?? 0),
  };
  return text.replace(/\{([a-zA-Z]+)\}/g, (all, k: string) => values[k] ?? all);
}
