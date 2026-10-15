import "server-only";
import { db } from "./db";
import type { Ctx } from "./auth";
import { istDay } from "./ledger";
import { beatRunsOn } from "./rules";

import { METRIC_LABEL } from "./metric-labels";
import { userLabel } from "@/lib/identity";
export { METRIC_LABEL };
export const isMoney = (m: string) => m === "SALES" || m === "COLLECTIONS";

const istStart = (ymd: string) => new Date(`${ymd}T00:00:00+05:30`);
const istEnd = (ymd: string) => new Date(`${ymd}T23:59:59.999+05:30`);
const addDays = (ymd: string, n: number) => istDay(new Date(new Date(`${ymd}T12:00:00+05:30`).getTime() + n * 86400_000));

const who = (users: { id: string; name: string | null; phone: string | null; email: string | null }[], id: string) => { const u = users.find((x) => x.id === id); return u ? (userLabel(u)) : "—"; };

export type Progress = { userId: string; name: string; metric: string; actual: number; target: number | null; expected: number | null };

/** Month-to-date actuals per rep, against targets pro-rated to today (FS-05). */
export async function teamProgress(ctx: Ctx, month: string, today: string): Promise<Progress[]> {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const first = `${month}-01`;
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const last = `${month}-${String(daysInMonth).padStart(2, "0")}`;
  const upTo = today < last ? today : last;
  const elapsed = today < first ? 0 : Math.min(daysInMonth, Number(upTo.slice(8)));
  const range = { gte: istStart(first), lte: istEnd(upTo) };
  const bid = ctx.business.id;
  const reps = await db.membership.findMany({ where: { businessId: bid, role: { in: ["REP", "BILLING", "ADMIN", "OWNER"] } }, include: { user: true } });
  const targets = await db.target.findMany({ where: { businessId: bid, month } });
  const [visits, orders, got, newParties] = await Promise.all([
    db.visit.groupBy({ by: ["userId"], where: { businessId: bid, checkInAt: range }, _count: true }),
    db.order.groupBy({ by: ["createdById"], where: { businessId: bid, kind: "SALES", status: { not: "CANCELLED" }, createdAt: range }, _count: true, _sum: { totalPaise: true } }),
    db.ledgerEntry.groupBy({ by: ["createdById"], where: { businessId: bid, direction: "GOT", paymentMode: { not: null }, reversedBy: null, reversalOfId: null, createdAt: range }, _sum: { amountPaise: true } }),
    db.party.groupBy({ by: ["ownerId"], where: { businessId: bid, createdAt: range }, _count: true }),
  ]);
  const out: Progress[] = [];
  for (const r of reps) {
    const has = targets.filter((t) => t.userId === r.userId);
    const actual: Record<string, number> = {
      VISITS: visits.find((v) => v.userId === r.userId)?._count ?? 0,
      ORDERS: orders.find((o) => o.createdById === r.userId)?._count ?? 0,
      SALES: Number(orders.find((o) => o.createdById === r.userId)?._sum.totalPaise ?? 0),
      COLLECTIONS: Number(got.find((g) => g.createdById === r.userId)?._sum.amountPaise ?? 0),
      NEW_CUSTOMERS: newParties.find((p) => p.ownerId === r.userId)?._count ?? 0,
    };
    const metrics = new Set([...has.map((t) => t.metric), ...Object.keys(actual)]);
    for (const metric of metrics) {
      const t = has.find((x) => x.metric === metric);
      const target = t ? Number(t.value) : null;
      out.push({ userId: r.userId, name: userLabel(r.user), metric, actual: actual[metric], target, expected: target === null ? null : Math.round((target * elapsed) / daysInMonth) });
    }
  }
  return out;
}

/** Who is out right now, with the distance flag from check-in (FS-05). */
export async function liveVisits(ctx: Ctx, day: string) {
  const bid = ctx.business.id;
  const vs = await db.visit.findMany({ where: { businessId: bid, checkInAt: { gte: istStart(day), lte: istEnd(day) } }, orderBy: { checkInAt: "desc" }, take: 200 });
  const [users, parties] = await Promise.all([
    db.user.findMany({ where: { id: { in: [...new Set(vs.map((v) => v.userId))] } } }),
    db.party.findMany({ where: { id: { in: [...new Set(vs.map((v) => v.partyId))] } }, select: { id: true, name: true } }),
  ]);
  return vs.map((v) => ({
    id: v.id, rep: who(users, v.userId), party: parties.find((p) => p.id === v.partyId)?.name ?? "—",
    at: v.checkInAt, out: v.checkOutAt, distanceM: v.distanceM, outcome: v.outcome,
  }));
}

/** Planned beat stops that had no visit (FS-04 missed-visit report). */
export async function missedVisits(ctx: Ctx, from: string, to: string) {
  const bid = ctx.business.id;
  const [beats, visits] = await Promise.all([
    db.beat.findMany({ where: { businessId: bid, archivedAt: null }, include: { parties: true } }),
    db.visit.findMany({ where: { businessId: bid, checkInAt: { gte: istStart(from), lte: istEnd(to) } } }),
  ]);
  const [users, parties] = await Promise.all([
    db.user.findMany({ where: { id: { in: beats.map((b) => b.userId) } } }),
    db.party.findMany({ where: { id: { in: beats.flatMap((b) => b.parties.map((p) => p.partyId)) } }, select: { id: true, name: true } }),
  ]);
  const rows: { date: string; rep: string; beat: string; party: string }[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const wd = new Date(`${d}T12:00:00+05:30`).getUTCDay();
    for (const b of beats) {
      if (!beatRunsOn(b.weekdays, wd)) continue;
      for (const bp of b.parties) {
        const hit = visits.some((v) => v.userId === b.userId && v.partyId === bp.partyId && istDay(v.checkInAt) === d);
        if (!hit) rows.push({ date: d, rep: who(users, b.userId), beat: b.name, party: parties.find((p) => p.id === bp.partyId)?.name ?? "—" });
      }
    }
  }
  return rows;
}

export async function attendanceRows(ctx: Ctx, from: string, to: string) {
  const a = await db.attendance.findMany({ where: { businessId: ctx.business.id, date: { gte: from, lte: to } }, orderBy: [{ date: "desc" }] });
  const users = await db.user.findMany({ where: { id: { in: [...new Set(a.map((x) => x.userId))] } } });
  return a.map((x) => ({ date: x.date, rep: who(users, x.userId), at: x.checkInAt, source: x.source, hasPhoto: !!x.photoFileId }));
}
