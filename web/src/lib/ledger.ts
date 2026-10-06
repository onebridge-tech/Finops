// Pure ledger maths, shared by server queries and tests.

export type EntryLike = {
  id: string;
  direction: "GAVE" | "GOT" | string;
  amountPaise: bigint | number;
  date: Date;
  dueDate?: Date | null;
  reversalOfId?: string | null;
};

export function signed(e: EntryLike): number {
  const amt = Number(e.amountPaise);
  return e.direction === "GAVE" ? amt : -amt;
}

/** Positive = the party owes us (receivable). Negative = we owe them (payable). */
export function balanceOf(entries: EntryLike[]): number {
  return entries.reduce((sum, e) => sum + signed(e), 0);
}

/** Entries sorted oldest-first with a running balance column. */
export function withRunningBalance<T extends EntryLike>(entries: T[]): (T & { running: number })[] {
  let running = 0;
  return [...entries]
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .map((e) => {
      running += signed(e);
      return { ...e, running };
    });
}

/** IDs of entries that have been reversed (or are reversals) — shown struck through. */
export function reversedIds(entries: EntryLike[]): Set<string> {
  const ids = new Set<string>();
  for (const e of entries) {
    if (e.reversalOfId) {
      ids.add(e.id);
      ids.add(e.reversalOfId);
    }
  }
  return ids;
}

export type OpenDue = { id: string; date: Date; due: Date; open: number };

/** A receipt assigned to a specific bill (CP-10). */
export type AllocationLike = { receiptEntryId: string; invoiceEntryId: string; amountPaise: bigint | number };

/**
 * Unpaid part of each credit entry. Receipts the user assigned to specific bills
 * settle those first (never more than the receipt or the bill holds); whatever
 * is left of every receipt settles the oldest dues first. A GAVE entry with no
 * due date is treated as due on its entry date.
 */
export function openDues(entries: EntryLike[], allocations: AllocationLike[] = []): OpenDue[] {
  const cancelled = reversedIds(entries);
  const sorted = entries.filter((e) => !cancelled.has(e.id)).sort((a, b) => a.date.getTime() - b.date.getTime());
  const open = new Map(sorted.filter((e) => e.direction === "GAVE").map((e) => [e.id, Number(e.amountPaise)]));
  const receiptLeft = new Map(sorted.filter((e) => e.direction === "GOT").map((e) => [e.id, Number(e.amountPaise)]));

  for (const al of allocations) {
    const bill = open.get(al.invoiceEntryId);
    const have = receiptLeft.get(al.receiptEntryId);
    if (bill === undefined || have === undefined) continue; // one side was reversed or isn't this party's
    const applied = Math.min(Number(al.amountPaise), bill, have);
    open.set(al.invoiceEntryId, bill - applied);
    receiptLeft.set(al.receiptEntryId, have - applied);
  }

  let credits = [...receiptLeft.values()].reduce((x, y) => x + y, 0);
  const result: OpenDue[] = [];
  for (const e of sorted) {
    if (e.direction !== "GAVE") continue;
    const amt = open.get(e.id)!;
    const settled = Math.min(credits, amt);
    credits -= settled;
    if (amt > settled) result.push({ id: e.id, date: e.date, due: e.dueDate ?? e.date, open: amt - settled });
  }
  return result;
}

/** How much of each bill is still unpaid, keyed by entry id (bills with nothing open are absent). */
export function openByEntry(entries: EntryLike[], allocations: AllocationLike[] = []): Map<string, number> {
  return new Map(openDues(entries, allocations).map((d) => [d.id, d.open]));
}

/** Unpaid amount whose due day (IST) is before today. */
export function overdueAmount(entries: EntryLike[], today: Date, allocations: AllocationLike[] = []): number {
  return openDues(entries, allocations)
    .filter((d) => daysBetween(d.due, today) > 0)
    .reduce((s, d) => s + d.open, 0);
}

/** Calendar day in IST as yyyy-mm-dd. */
export function istDay(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

/** Whole IST calendar days from a to b (b − a). */
export function daysBetween(a: Date, b: Date): number {
  return Math.round((Date.parse(istDay(b)) - Date.parse(istDay(a))) / 86400_000);
}

export const AGEING_BUCKETS = ["0-30", "31-60", "61-90", "90+"] as const;
export type AgeingBucket = (typeof AGEING_BUCKETS)[number];

/** Overdue amount split by how many days past due (CP-03 / CP-06). */
export function ageing(entries: EntryLike[], today: Date, allocations: AllocationLike[] = []): Record<AgeingBucket, number> {
  const out: Record<AgeingBucket, number> = { "0-30": 0, "31-60": 0, "61-90": 0, "90+": 0 };
  for (const d of openDues(entries, allocations)) {
    const late = daysBetween(d.due, today);
    if (late <= 0) continue;
    out[late <= 30 ? "0-30" : late <= 60 ? "31-60" : late <= 90 ? "61-90" : "90+"] += d.open;
  }
  return out;
}
