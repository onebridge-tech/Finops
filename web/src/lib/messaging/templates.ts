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
  INVITE: (v) => `${v.business} keeps your account on our ledger app. See your balance and every entry for free: ${v.link}`,
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
  INVITE: (v) => `${v.business} आपका खाता हमारे लेजर ऐप पर रखता है। अपना बैलेंस और हर एंट्री मुफ्त में देखें: ${v.link}`,
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
  INVITE: (v) => `${v.business} మీ ఖాతాను మా లెడ్జర్ యాప్‌లో ఉంచుతుంది. మీ బాకీ, ప్రతి ఎంట్రీ ఉచితంగా చూడండి: ${v.link}`,
};

export const LANGUAGES: Record<string, Lang> = { en, hi, te };

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
