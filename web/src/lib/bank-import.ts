import { createHash } from "node:crypto";

// Reading a bank or UPI statement (CSV or Excel) into plain transactions. Pure, so it is easy to test.
// Banks lay these files out differently: some put account details above the table, some use one Amount
// column with Dr/Cr, some use separate Debit and Credit columns, dates come as 14/10/2026 or 14-Oct-26.

export type Direction = "IN" | "OUT";

export type Txn = { date: string; description: string; direction: Direction; amountPaise: number; balancePaise: number | null; ref: string | null };

export const FIELDS = [
  { key: "date", label: "Date", required: true, aliases: ["date", "txn date", "transaction date", "value date", "posting date", "tran date", "value dt", "txn dt"] },
  { key: "description", label: "Description", required: true, aliases: ["description", "narration", "particulars", "remarks", "transaction remarks", "details", "transaction details", "narrative", "transaction particulars"] },
  { key: "debit", label: "Money out (Debit)", aliases: ["debit", "withdrawal", "withdrawals", "debit amount", "withdrawal amt", "withdrawal amount", "dr amount", "money out", "paid out", "dr"] },
  { key: "credit", label: "Money in (Credit)", aliases: ["credit", "deposit", "deposits", "credit amount", "deposit amt", "deposit amount", "cr amount", "money in", "paid in", "cr"] },
  { key: "amount", label: "Amount (one column)", aliases: ["amount", "txn amount", "transaction amount", "amt"] },
  { key: "type", label: "Dr / Cr", aliases: ["dr/cr", "cr/dr", "type", "transaction type", "debit/credit"] },
  { key: "balance", label: "Balance", aliases: ["balance", "closing balance", "running balance", "bal", "available balance"] },
  { key: "ref", label: "Reference", aliases: ["ref", "ref no", "reference", "reference no", "chq/ref no", "chq no", "cheque no", "utr", "transaction id", "txn id", "utr no"] },
] as const;
export type FieldKey = (typeof FIELDS)[number]["key"];
export type Mapping = Partial<Record<FieldKey, number>>;

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9/ ]+/g, " ").replace(/\s+/g, " ").trim();

/** Which column is which, by the header words. */
export function guessMapping(header: string[]): Mapping {
  const m: Mapping = {};
  const names = header.map(norm);
  for (const f of FIELDS) {
    const exact = names.findIndex((h, i) => (f.aliases as readonly string[]).includes(h) && !Object.values(m).includes(i));
    const loose = exact >= 0 ? exact : names.findIndex((h, i) => h !== "" && f.aliases.some((a) => a.length > 3 && h.includes(a)) && !Object.values(m).includes(i));
    if (loose >= 0) m[f.key] = loose;
  }
  return m;
}

/** Many statements start with the account name and period. The table begins at the first row that looks like a header. */
export function findHeaderRow(table: string[][]): number {
  for (let i = 0; i < Math.min(table.length, 40); i++) {
    const g = guessMapping(table[i] ?? []);
    if (g.date !== undefined && (g.description !== undefined || g.amount !== undefined || g.debit !== undefined || g.credit !== undefined)) return i;
  }
  return 0;
}

const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
const pad = (n: number) => String(n).padStart(2, "0");

function valid(y: number, m: number, d: number): string | null {
  if (y < 2000 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCMonth() === m - 1 ? `${y}-${pad(m)}-${pad(d)}` : null;
}

/** A date as YYYY-MM-DD, or null. Day comes first (Indian banks), as in 03/04/2026 = 3 April. */
export function parseDate(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(s);
  if (m) return valid(+m[1]!, +m[2]!, +m[3]!);
  m = /^(\d{1,2})[-/. ](\d{1,2})[-/. ](\d{2,4})/.exec(s);
  if (m) return valid(m[3]!.length === 2 ? 2000 + +m[3]! : +m[3]!, +m[2]!, +m[1]!);
  m = /^(\d{1,2})[-/. ]([A-Za-z]{3,9})[-/. ,]*(\d{2,4})/.exec(s);
  if (m) {
    const mon = MONTHS[m[2]!.toLowerCase().slice(0, 4)] ?? MONTHS[m[2]!.toLowerCase().slice(0, 3)];
    return mon ? valid(m[3]!.length === 2 ? 2000 + +m[3]! : +m[3]!, mon, +m[1]!) : null;
  }
  if (/^\d{5}(\.\d+)?$/.test(s) && +s > 30000 && +s < 70000) {
    // Excel stores dates as days since 1899-12-30.
    const t = new Date(Date.UTC(1899, 11, 30) + Math.floor(+s) * 86_400_000);
    return valid(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
  }
  return null;
}

/** An amount in rupees as paise. A trailing Dr/Cr and brackets are understood. Returns null when it is not a number. */
export function parseMoney(raw: string): { paise: number; sign: -1 | 0 | 1; side: Direction | null } | null {
  let s = raw.trim();
  if (!s || s === "-" || s === "--") return null;
  let side: Direction | null = null;
  const tail = /\s*(dr|cr)\.?$/i.exec(s);
  if (tail) { side = tail[1]!.toLowerCase() === "dr" ? "OUT" : "IN"; s = s.slice(0, tail.index); }
  const neg = /^\(.*\)$/.test(s) || /^-/.test(s.replace(/^[^\d(-]+/, ""));
  s = s.replace(/[₹,\s]|rs\.?|inr/gi, "").replace(/^\(|\)$/g, "").replace(/^-/, "");
  if (!/^\d+(\.\d{1,3})?$/.test(s)) return null;
  const paise = Math.round(parseFloat(s) * 100);
  return { paise, sign: paise === 0 ? 0 : neg ? -1 : 1, side };
}

export type Parsed = { txns: Txn[]; errors: { row: number; reason: string }[] };

/** Turns the table rows (below the header) into transactions using the chosen columns. `firstRow` is for error messages. */
export function buildTxns(rows: string[][], map: Mapping, firstRow = 2): Parsed {
  const txns: Txn[] = [];
  const errors: Parsed["errors"] = [];
  const cell = (r: string[], k: FieldKey) => (map[k] === undefined ? "" : String(r[map[k]!] ?? "").trim());
  rows.forEach((r, i) => {
    const rowNo = firstRow + i;
    if (r.every((c) => !String(c ?? "").trim())) return;
    const date = parseDate(cell(r, "date"));
    const desc = cell(r, "description").replace(/\s+/g, " ");
    if (!date) {
      // Totals, opening balance lines and footers have no date; they are not mistakes.
      if (!/opening|closing|total|balance|statement|generated/i.test(r.join(" ")) && cell(r, "date")) errors.push({ row: rowNo, reason: `Date “${cell(r, "date")}” not understood` });
      return;
    }
    let amount = 0;
    let direction: Direction | null = null;
    const debit = parseMoney(cell(r, "debit"));
    const credit = parseMoney(cell(r, "credit"));
    if (debit && debit.paise > 0 && !(credit && credit.paise > 0)) { amount = debit.paise; direction = "OUT"; }
    else if (credit && credit.paise > 0 && !(debit && debit.paise > 0)) { amount = credit.paise; direction = "IN"; }
    else if (map.amount !== undefined) {
      const a = parseMoney(cell(r, "amount"));
      if (a && a.paise > 0) {
        const t = cell(r, "type").toLowerCase();
        const byType: Direction | null = /^(dr|debit|d|w)/.test(t) ? "OUT" : /^(cr|credit|c|dep)/.test(t) ? "IN" : null;
        direction = byType ?? a.side ?? (a.sign < 0 ? "OUT" : "IN");
        amount = a.paise;
      }
    }
    if (!direction || amount <= 0) { errors.push({ row: rowNo, reason: "No amount found" }); return; }
    const bal = parseMoney(cell(r, "balance"));
    txns.push({ date, description: desc || "(no description)", direction, amountPaise: amount, balancePaise: bal ? (bal.sign < 0 || bal.side === "OUT" ? -bal.paise : bal.paise) : null, ref: cell(r, "ref") || null });
  });
  return { txns, errors };
}

export type BalanceCheck = { checked: number; order: "oldest-first" | "newest-first"; mismatches: { date: string; description: string; amountPaise: number; direction: Direction; expectedPaise: number; shownPaise: number }[] };

/**
 * Proof the rows were read right: each balance must equal the one before it plus money in, minus money out. A row
 * that was missed or an amount that was misread breaks the chain at that row. Statements list oldest or newest
 * first; the order that fits more rows is used. Null when the statement has no balance column to check against.
 */
export function checkBalances(txns: Txn[]): BalanceCheck | null {
  const withBal = txns.filter((t) => t.balancePaise !== null);
  if (withBal.length < 2 || withBal.length < txns.length) return null;
  const signed = (t: Txn) => (t.direction === "IN" ? t.amountPaise : -t.amountPaise);
  const run = (list: Txn[]) => {
    const bad: BalanceCheck["mismatches"] = [];
    for (let i = 1; i < list.length; i++) {
      const expected = list[i - 1]!.balancePaise! + signed(list[i]!);
      if (expected !== list[i]!.balancePaise) bad.push({ date: list[i]!.date, description: list[i]!.description, amountPaise: list[i]!.amountPaise, direction: list[i]!.direction, expectedPaise: expected, shownPaise: list[i]!.balancePaise! });
    }
    return bad;
  };
  const asc = run(withBal);
  const desc = run([...withBal].reverse());
  return desc.length < asc.length
    ? { checked: withBal.length - 1, order: "newest-first", mismatches: desc }
    : { checked: withBal.length - 1, order: "oldest-first", mismatches: asc };
}

/** The same transaction in two overlapping statements has the same fingerprint, so it is only counted once. */
export function txnHash(t: Txn): string {
  return createHash("sha1").update([t.date, t.direction, t.amountPaise, t.balancePaise ?? "", t.description.toLowerCase().replace(/[^a-z0-9]+/g, "")].join("|")).digest("hex");
}

const STOP = new Set(["upi", "cr", "dr", "neft", "imps", "rtgs", "ach", "nach", "pos", "ecom", "atm", "cash", "wdl", "dep", "chq", "cheque", "clg", "int", "pay", "payment", "payu", "ibl", "okaxis", "okhdfcbank", "oksbi", "okicici", "ybl", "paytm", "axl", "hdfc", "icici", "sbi", "axis", "bank", "ltd", "the", "to", "from", "by", "for", "transfer", "trf", "mob", "net", "banking", "bil", "online", "ref", "no"]);

/** Who the money went to or came from, as well as the description allows. */
export function counterparty(description: string): string | null {
  const parts = description.split(/[\/\-|*:@,]+/).map((p) => p.trim()).filter(Boolean);
  for (const p of parts) {
    const words = p.split(/\s+/);
    if (/^\d+$/.test(p) || /^[a-z0-9._]+$/i.test(p) && /\d/.test(p)) continue; // numbers, UTRs, ids
    const real = words.filter((w) => /^[A-Za-z][A-Za-z.&']{1,}$/.test(w) && !STOP.has(w.toLowerCase()));
    if (real.length >= 1 && real.join("").length >= 3) return real.slice(0, 4).join(" ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return null;
}
