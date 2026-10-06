// Phase 2 business rules. All pure, so they're unit-tested without a database.

// ── Credit control (CP-07) ───────────────────────────────────────────────────

export type CreditControl = "OFF" | "WARN" | "BLOCK";

export type CreditCheck = {
  action: "ok" | "warn" | "block";
  reasons: string[];
};

/**
 * Whether a new bill or credit should be allowed. `balance` and `overdue` are the
 * party's current receivable and overdue amounts in paise; `newAmount` is what
 * is about to be added. A member allowed to override only ever gets a warning.
 */
export function checkCredit(o: {
  control: CreditControl;
  limitPaise: number | null;
  balance: number;
  overdue: number;
  newAmount: number;
  blockOverdue: boolean;
  canOverride: boolean;
  fmt: (paise: number) => string;
}): CreditCheck {
  if (o.control === "OFF") return { action: "ok", reasons: [] };
  const reasons: string[] = [];
  if (o.limitPaise !== null && o.balance + o.newAmount > o.limitPaise) {
    reasons.push(`This would take them to ${o.fmt(o.balance + o.newAmount)}, over their credit limit of ${o.fmt(o.limitPaise)}`);
  }
  if (o.blockOverdue && o.overdue > 0) {
    reasons.push(`They already have ${o.fmt(o.overdue)} overdue`);
  }
  if (reasons.length === 0) return { action: "ok", reasons };
  return { action: o.control === "BLOCK" && !o.canOverride ? "block" : "warn", reasons };
}

// ── Promise to pay (CP-09) ───────────────────────────────────────────────────

export type PromiseStatus = "OPEN" | "KEPT" | "BROKEN";

/**
 * A promise is kept when payments received since it was made cover the promised
 * amount (or, with no amount, the whole balance at that time); it is broken
 * when the promised day has passed without that, and open until then.
 */
export function promiseStatus(p: {
  promisedFor: Date;
  amountPaise: number | null;
  receivedSince: number;
  balanceNow: number;
  today: Date;
  istDay: (d: Date) => string;
}): PromiseStatus {
  const kept = p.amountPaise !== null ? p.receivedSince >= p.amountPaise : p.balanceNow <= 0;
  if (kept) return "KEPT";
  return p.istDay(p.today) > p.istDay(p.promisedFor) ? "BROKEN" : "OPEN";
}

/** Auto-reminders pause until the day after the promised date. */
export function snoozeUntil(promisedFor: Date): Date {
  return new Date(promisedFor.getTime() + 24 * 3600_000);
}

// ── Price lists (CI-03) ──────────────────────────────────────────────────────

export type PriceRow = { itemId: string; minQtyMilli: number; ratePaise: number };

/**
 * The rate to use for an item and quantity: on the party's price list the slab
 * with the largest minimum quantity not above the order quantity, otherwise the
 * item's standard price.
 */
export function priceFor(rows: PriceRow[], itemId: string, qtyMilli: number, standardPaise: number): number {
  let best: PriceRow | null = null;
  for (const r of rows) {
    if (r.itemId !== itemId || r.minQtyMilli > qtyMilli) continue;
    if (!best || r.minQtyMilli > best.minQtyMilli) best = r;
  }
  return best ? best.ratePaise : standardPaise;
}

// ── Stock (CI-04) ────────────────────────────────────────────────────────────

export function stockLevel(movements: { qtyMilli: number }[]): number {
  return movements.reduce((s, m) => s + m.qtyMilli, 0);
}

/** Low once stock is at or below the reorder level. */
export function isLowStock(levelMilli: number, reorderMilli: number | null): boolean {
  return reorderMilli !== null && levelMilli <= reorderMilli;
}

/** The stock movement an invoice line makes: stock goes out. */
export function lineStockDelta(qtyMilli: number, kind: "SALE" | "RETURN" | "PURCHASE" | "CANCEL_SALE"): number {
  return kind === "SALE" ? -qtyMilli : qtyMilli;
}

// ── Orders (BD-02) ───────────────────────────────────────────────────────────

export type OrderStatus = "REQUEST" | "OPEN" | "PARTIAL" | "FULFILLED" | "CANCELLED";

export function orderStatus(lines: { qtyMilli: number; fulfilledMilli: number }[]): Exclude<OrderStatus, "REQUEST" | "CANCELLED"> {
  const done = lines.every((l) => l.fulfilledMilli >= l.qtyMilli);
  if (done) return "FULFILLED";
  return lines.some((l) => l.fulfilledMilli > 0) ? "PARTIAL" : "OPEN";
}

/** Quantity of a line still to deliver. */
export function pendingMilli(l: { qtyMilli: number; fulfilledMilli: number }): number {
  return Math.max(0, l.qtyMilli - l.fulfilledMilli);
}

// ── Cashbook (LG-08) ─────────────────────────────────────────────────────────

export type CashMove = { at: Date; direction: "IN" | "OUT"; amountPaise: number; label: string; ref?: string };

/** Moves in time order with a running cash balance; `opening` is cash in hand before the first move. */
export function cashRunning(opening: number, moves: CashMove[]): (CashMove & { balance: number })[] {
  let bal = opening;
  return [...moves]
    .sort((a, b) => a.at.getTime() - b.at.getTime())
    .map((m) => ({ ...m, balance: (bal += m.direction === "IN" ? m.amountPaise : -m.amountPaise) }));
}

// ── Beats and visits (FS-04) ─────────────────────────────────────────────────

/** Distance in metres between two coordinates (haversine). */
export function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

/** Whether a beat is walked on this weekday (0 = Sunday). */
export function beatRunsOn(weekdays: string, day: number): boolean {
  return weekdays.split(",").map((x) => x.trim()).includes(String(day));
}

// ── Inactive customers and upsell (IR-04) ────────────────────────────────────

/** Days since the last order, or null when there has never been one. */
export function daysSince(last: Date | null, today: Date, daysBetween: (a: Date, b: Date) => number): number | null {
  return last ? daysBetween(last, today) : null;
}

/**
 * Categories a party buys from, against peers: flagged when they buy from fewer
 * than half the categories the median customer buys from (and the median buys
 * from at least 3).
 */
export function buysFewerCategories(own: number, peers: number[]): boolean {
  if (peers.length < 3) return false;
  const sorted = [...peers].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  return median >= 3 && own * 2 < median;
}
