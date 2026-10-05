type Q = { status: string; validUntil: Date | null; viewCount: number };

/** Display status: sent → viewed → accepted/declined → converted, or expired. */
export function quoteStatus(q: Q, now = new Date()): { label: string; tone: string } {
  if (q.status === "CONVERTED") return { label: "Invoiced", tone: "text-got" };
  if (q.status === "ACCEPTED") return { label: "Accepted", tone: "text-got" };
  if (q.status === "DECLINED") return { label: "Declined", tone: "text-gave" };
  if (q.validUntil && q.validUntil < now) return { label: "Expired", tone: "text-muted" };
  return q.viewCount > 0 ? { label: `Viewed ${q.viewCount}×`, tone: "text-brand" } : { label: "Sent", tone: "text-muted" };
}
