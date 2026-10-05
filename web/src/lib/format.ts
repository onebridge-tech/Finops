// Display helpers shared by server code and components.

export function fmtDate(d: Date | null | undefined) {
  return d ? d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }) : "—";
}

/** yyyy-mm-dd in IST, for <input type="date"> defaults. */
export function todayIST() {
  return new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
}

export function daysAgo(n: number) {
  return new Date(Date.now() - n * 86400_000);
}

export const PAYMENT_MODES = ["CASH", "UPI", "BANK", "CHEQUE", "CARD", "OTHER"] as const;
export type PaymentMode = (typeof PAYMENT_MODES)[number];
export const PAYMENT_MODE_LABEL: Record<PaymentMode, string> = {
  CASH: "Cash", UPI: "UPI", BANK: "Bank transfer", CHEQUE: "Cheque", CARD: "Card", OTHER: "Other",
};
