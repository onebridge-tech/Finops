import "server-only";
import { db } from "./db";
import { reversedIds, signed } from "./ledger";

const isYmd = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

/**
 * Party statement for a period (LG-05): balance brought forward, the entries in
 * the period (reversed pairs left out, as they cancel), and the closing balance.
 */
export async function statement(partyId: string, fromParam?: unknown, toParam?: unknown) {
  const from = isYmd(fromParam) ? new Date(`${fromParam}T00:00:00+05:30`) : null;
  const to = isYmd(toParam) ? new Date(`${toParam}T23:59:59+05:30`) : null;
  const all = await db.ledgerEntry.findMany({ where: { partyId }, orderBy: [{ date: "asc" }, { createdAt: "asc" }] });
  const struck = reversedIds(all);
  const live = all.filter((e) => !struck.has(e.id));

  const opening = live.filter((e) => from && e.date < from).reduce((s, e) => s + signed(e), 0);
  let running = opening;
  const rows = live
    .filter((e) => (!from || e.date >= from) && (!to || e.date <= to))
    .map((e) => ({ ...e, running: (running += signed(e)) }));
  const files = await db.storedFile.findMany({ where: { entryId: { in: rows.map((r) => r.id) } }, select: { id: true, name: true, mime: true, entryId: true } });
  return {
    from: isYmd(fromParam) ? fromParam : null,
    to: isYmd(toParam) ? toParam : null,
    opening,
    rows,
    closing: running,
    current: live.reduce((s, e) => s + signed(e), 0),
    filesByEntry: Map.groupBy(files, (f) => f.entryId!),
    totalGave: rows.filter((r) => r.direction === "GAVE").reduce((s, r) => s + Number(r.amountPaise), 0),
    totalGot: rows.filter((r) => r.direction === "GOT").reduce((s, r) => s + Number(r.amountPaise), 0),
  };
}
