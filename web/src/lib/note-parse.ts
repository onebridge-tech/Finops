// Turning the AI's answer about a photo of a paper note into rows the shop owner can check. Pure, so it is unit-tested.
import { isoDate } from "./purchase";

export type NoteRow = { date: string; item: string; qty: number | null; amountPaise: number; type: "IN" | "OUT"; confidence: number };
export type ParsedNote = { rows: NoteRow[]; pageDate: string | null; problems: string[] };

export const NOTE_PROMPT = [
  "This is a photo of a paper note kept by a small shop owner in India. It lists items and rupee amounts, often without any names or phone numbers.",
  "Read every line that has an amount. The writing may be in English, Telugu, Hindi, Tamil or Kannada, and may be messy.",
  "Rules:",
  "- Keep each item name in the language it is written in. Write digits as 0-9.",
  "- amount is in rupees as a plain number (no currency sign). If a line has a quantity, put it in qty, otherwise null.",
  "- type is \"IN\" for a sale or money received, and \"OUT\" for money the shop paid out (a purchase, rent, salary, expense). If unmarked, a line that looks like something sold is \"IN\".",
  "- Skip totals, sub-totals and lines with no amount. Never invent an item, a quantity or an amount. If you cannot read a line, leave it out and say so in problems.",
  "- date is YYYY-MM-DD for a line that has its own date, otherwise null. page_date is the date written on the page, or null.",
  "- confidence is a number from 0 to 1 for how sure you are of the line.",
  "Answer with only this JSON, nothing else:",
  "{\"page_date\": string|null, \"rows\": [{\"date\": string|null, \"item\": string, \"qty\": number|null, \"amount\": number, \"type\": \"IN\"|\"OUT\", \"confidence\": number}], \"problems\": string[]}",
].join("\n");

const MAX_ROWS = 300;

/** Pulls the JSON object out of a reply that may be wrapped in text or code fences. */
function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

const num = (v: unknown): number | null => {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") { const n = Number(v.replace(/[₹,\s]/g, "")); return v.trim() && Number.isFinite(n) ? n : null; }
  return null;
};

/** `today` is the day to use for lines with no readable date and `maxDate` the latest date allowed (usually the same day). */
export function parseNoteResponse(text: string, today: string): ParsedNote {
  const problems: string[] = [];
  const raw = extractJson(text);
  if (!raw || typeof raw !== "object") return { rows: [], pageDate: null, problems: ["The reading did not come back in a usable form. Please try the photo again."] };
  const o = raw as { page_date?: unknown; rows?: unknown; problems?: unknown };
  const pd = typeof o.page_date === "string" ? isoDate(o.page_date) : null;
  const pageDate = pd && pd <= today ? pd : null;
  if (Array.isArray(o.problems)) for (const p of o.problems.slice(0, 5)) if (typeof p === "string" && p.trim()) problems.push(p.trim().slice(0, 160));
  const rows: NoteRow[] = [];
  if (!Array.isArray(o.rows)) return { rows, pageDate, problems: [...problems, "No lines were found on the page."] };
  let dropped = 0;
  for (const r of o.rows.slice(0, MAX_ROWS)) {
    if (!r || typeof r !== "object") { dropped++; continue; }
    const x = r as Record<string, unknown>;
    const item = typeof x.item === "string" ? x.item.replace(/\s+/g, " ").trim().slice(0, 120) : "";
    const amount = num(x.amount);
    if (!item || amount === null || amount <= 0 || amount > 10_000_000) { dropped++; continue; }
    const d = typeof x.date === "string" ? isoDate(x.date) : null;
    const qty = num(x.qty);
    const conf = num(x.confidence);
    rows.push({
      date: d && d <= today ? d : pageDate ?? today,
      item,
      qty: qty !== null && qty > 0 && qty < 1_000_000 ? qty : null,
      amountPaise: Math.round(amount * 100),
      type: x.type === "OUT" ? "OUT" : "IN",
      confidence: conf === null ? 0.5 : Math.min(1, Math.max(0, conf)),
    });
  }
  if (dropped > 0) problems.push(`${dropped} line${dropped === 1 ? "" : "s"} could not be read and ${dropped === 1 ? "was" : "were"} left out.`);
  if (rows.length === 0 && problems.length === 0) problems.push("No lines with an amount were found on the page.");
  return { rows, pageDate, problems };
}
