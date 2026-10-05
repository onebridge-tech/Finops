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

/**
 * Amount currently overdue, assuming payments (GOT) settle the oldest dues first.
 * A GAVE entry with no due date is treated as due immediately.
 */
export function overdueAmount(entries: EntryLike[], today: Date): number {
  const cancelled = reversedIds(entries);
  const sorted = entries.filter((e) => !cancelled.has(e.id)).sort((a, b) => a.date.getTime() - b.date.getTime());
  let credits = sorted.filter((e) => e.direction === "GOT").reduce((s, e) => s + Number(e.amountPaise), 0);
  let overdue = 0;
  for (const e of sorted) {
    if (e.direction !== "GAVE") continue;
    const amt = Number(e.amountPaise);
    const settled = Math.min(credits, amt);
    credits -= settled;
    const open = amt - settled;
    const due = e.dueDate ?? e.date;
    if (open > 0 && due.getTime() < today.getTime()) overdue += open;
  }
  return overdue;
}
