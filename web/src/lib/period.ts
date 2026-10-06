// Report periods (IR-02…IR-06). Pure, in IST calendar days. The Indian financial year runs April–March.

export const PERIOD_PRESETS = [
  ["today", "Today"],
  ["7d", "Last 7 days"],
  ["month", "This month"],
  ["lastmonth", "Last month"],
  ["quarter", "This quarter"],
  ["fy", "This financial year"],
  ["lastfy", "Last financial year"],
  ["custom", "Custom"],
] as const;
export type PeriodPreset = (typeof PERIOD_PRESETS)[number][0];

export type Period = {
  preset: PeriodPreset;
  from: string; // yyyy-mm-dd, inclusive
  to: string; // yyyy-mm-dd, inclusive
  label: string;
  /** The same-length period just before this one, for comparison. */
  prev: { from: string; to: string };
};

const MS = 86400_000;
const parse = (ymd: string) => Date.UTC(+ymd.slice(0, 4), +ymd.slice(5, 7) - 1, +ymd.slice(8, 10));
const fmt = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const ymd = (y: number, m: number, d: number) => fmt(Date.UTC(y, m, d));
const isYmd = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(parse(v));

/** Whole days from `from` to `to`, inclusive. */
export function daysIn(from: string, to: string): number {
  return Math.round((parse(to) - parse(from)) / MS) + 1;
}

/** The period of equal length ending the day before `from`. */
export function previousOf(from: string, to: string): { from: string; to: string } {
  const n = daysIn(from, to);
  return { from: fmt(parse(from) - n * MS), to: fmt(parse(from) - MS) };
}

/** Start year of the financial year containing the given date. */
export function fyStartYear(today: string): number {
  const y = +today.slice(0, 4);
  return +today.slice(5, 7) >= 4 ? y : y - 1;
}

export function resolvePeriod(raw: { period?: unknown; from?: unknown; to?: unknown }, today: string): Period {
  const preset = (PERIOD_PRESETS.find(([k]) => k === raw.period)?.[0] ?? "month") as PeriodPreset;
  const y = +today.slice(0, 4);
  const m = +today.slice(5, 7) - 1;
  let from = today;
  let to = today;
  switch (preset) {
    case "today": break;
    case "7d": from = fmt(parse(today) - 6 * MS); break;
    case "month": from = ymd(y, m, 1); to = fmt(Date.UTC(y, m + 1, 0)); break;
    case "lastmonth": from = ymd(y, m - 1, 1); to = fmt(Date.UTC(y, m, 0)); break;
    case "quarter": { const q = Math.floor(m / 3) * 3; from = ymd(y, q, 1); to = fmt(Date.UTC(y, q + 3, 0)); break; }
    case "fy": { const s = fyStartYear(today); from = ymd(s, 3, 1); to = ymd(s + 1, 2, 31); break; }
    case "lastfy": { const s = fyStartYear(today) - 1; from = ymd(s, 3, 1); to = ymd(s + 1, 2, 31); break; }
    case "custom":
      if (isYmd(raw.from) && isYmd(raw.to) && raw.from <= raw.to) { from = raw.from; to = raw.to; }
      else { from = ymd(y, m, 1); to = fmt(Date.UTC(y, m + 1, 0)); }
      break;
  }
  const label = from === to ? from : `${from} to ${to}`;
  return { preset, from, to, label, prev: previousOf(from, to) };
}

/** Start and end instants (IST) for a from/to pair of calendar days. */
export function rangeDates(from: string, to: string): { gte: Date; lte: Date } {
  return { gte: new Date(`${from}T00:00:00+05:30`), lte: new Date(`${to}T23:59:59.999+05:30`) };
}

/** yyyy-mm for a date, in IST. */
export function monthKey(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }).slice(0, 7);
}

/** Change from `prev` to `now` as a percentage, or null when there is nothing to compare. */
export function changePct(now: number, prev: number): number | null {
  if (prev === 0) return null;
  return Math.round(((now - prev) / Math.abs(prev)) * 1000) / 10;
}
