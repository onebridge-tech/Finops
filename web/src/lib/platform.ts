import "server-only";
import { db } from "./db";
import { istDay } from "./ledger";

// Numbers for the platform admin area. Everything here is counts and activity; none of it reads a
// shop's customers, amounts owed or notes.

const DAY = 86_400_000;
const ago = (days: number) => new Date(Date.now() - days * DAY);

type Series = { day: string; n: number }[];

/** A count per day for the last `days` days, with zeros filled in. `rows` come from a date_trunc query. */
function fill(rows: { day: Date; n: bigint }[], days: number): Series {
  const by = new Map(rows.map((r) => [istDay(new Date(r.day.getTime() + 12 * 3600_000)), Number(r.n)]));
  return Array.from({ length: days }, (_, i) => {
    const day = istDay(new Date(Date.now() - (days - 1 - i) * DAY));
    return { day, n: by.get(day) ?? 0 };
  });
}


export async function overview() {
  const since30 = ago(30);
  const since14 = ago(14);
  const [shops, users, shopsNew7, shopsNew30, usersNew7, sessions] = await Promise.all([
    db.business.count(),
    db.user.count(),
    db.business.count({ where: { createdAt: { gte: ago(7) } } }),
    db.business.count({ where: { createdAt: { gte: since30 } } }),
    db.user.count({ where: { createdAt: { gte: ago(7) } } }),
    db.session.findMany({ where: { lastActiveAt: { gte: since30 } }, select: { businessId: true, userId: true, lastActiveAt: true } }),
  ]);

  const within = (days: number) => sessions.filter((s) => s.lastActiveAt >= ago(days));
  const active = (days: number) => ({
    shops: new Set(within(days).map((s) => s.businessId).filter(Boolean)).size,
    users: new Set(within(days).map((s) => s.userId)).size,
  });

  const [signups, entries, bills, entries7, entriesPrev7, bills7, msgs, pay7, paySuccess] = await Promise.all([
    db.$queryRaw<{ day: Date; n: bigint }[]>`SELECT date_trunc('day', "createdAt" AT TIME ZONE 'Asia/Kolkata') AS day, count(*) AS n FROM "Business" WHERE "createdAt" >= ${since14} GROUP BY 1`,
    db.$queryRaw<{ day: Date; n: bigint }[]>`SELECT date_trunc('day', "createdAt" AT TIME ZONE 'Asia/Kolkata') AS day, count(*) AS n FROM "LedgerEntry" WHERE "createdAt" >= ${since14} AND "source" NOT IN ('REVERSAL','OPENING') GROUP BY 1`,
    db.$queryRaw<{ day: Date; n: bigint }[]>`SELECT date_trunc('day', "createdAt" AT TIME ZONE 'Asia/Kolkata') AS day, count(*) AS n FROM "Invoice" WHERE "createdAt" >= ${since14} GROUP BY 1`,
    db.ledgerEntry.count({ where: { createdAt: { gte: ago(7) }, source: { notIn: ["REVERSAL", "OPENING"] } } }),
    db.ledgerEntry.count({ where: { createdAt: { gte: ago(14), lt: ago(7) }, source: { notIn: ["REVERSAL", "OPENING"] } } }),
    db.invoice.count({ where: { createdAt: { gte: ago(7) } } }),
    db.message.groupBy({ by: ["status"], where: { createdAt: { gte: ago(7) } }, _count: true }),
    db.payment.aggregate({ where: { status: "PAID", paidAt: { gte: ago(7) } }, _count: true, _sum: { amountPaise: true } }),
    db.payment.count({ where: { status: "PAID" } }),
  ]);

  const shopsFirst = await db.business.findMany({ select: { id: true }, take: 2000 });
  const funnel = await signupFunnel(shopsFirst.map((s) => s.id));

  return {
    shops, users, shopsNew7, shopsNew30, usersNew7,
    active: { day: active(1), week: active(7), month: active(30) },
    signups: fill(signups, 14), entriesSeries: fill(entries, 14), billsSeries: fill(bills, 14),
    entries7, entriesPrev7, bills7,
    messages: Object.fromEntries(msgs.map((m) => [m.status, m._count])) as Record<string, number>,
    pay7: { count: pay7._count, paise: Number(pay7._sum.amountPaise ?? 0n) },
    paySuccess,
    funnel,
  };
}

/** How many shops reached each early step: created, added a customer, made a bill, sent a message. */
async function signupFunnel(ids: string[]) {
  if (ids.length === 0) return { shops: 0, customer: 0, bill: 0, message: 0 };
  const [p, i, m] = await Promise.all([
    db.party.groupBy({ by: ["businessId"], where: { businessId: { in: ids } } }),
    db.invoice.groupBy({ by: ["businessId"], where: { businessId: { in: ids } } }),
    db.message.groupBy({ by: ["businessId"], where: { businessId: { in: ids }, provider: { not: "link" } } }),
  ]);
  return { shops: ids.length, customer: p.length, bill: i.length, message: m.length };
}

export const PAGE_SIZE = 25;

export type ShopRow = {
  id: string; name: string; createdAt: Date; owner: string; ownerPhone: string | null; ownerEmail: string | null;
  lastActive: Date | null; parties: number; bills: number; entries: number; credits: number; members: number;
};

export async function shopsList(opts: { q: string; sort: "new" | "active" | "busy" | "name"; page: number }) {
  const q = opts.q.trim();
  const businesses = await db.business.findMany({
    where: q
      ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { memberships: { some: { user: { OR: [{ phone: { contains: q.replace(/\D/g, "") || "x" } }, { email: { contains: q, mode: "insensitive" } }, { name: { contains: q, mode: "insensitive" } }] } } } }] }
      : {},
    select: { id: true, name: true, createdAt: true, creditBalance: true, memberships: { select: { role: true, createdAt: true, user: { select: { name: true, phone: true, email: true } } } } },
    take: 2000,
  });
  const ids = businesses.map((b) => b.id);
  const [seen, parties, bills, entries] = await Promise.all([
    db.session.groupBy({ by: ["businessId"], where: { businessId: { in: ids } }, _max: { lastActiveAt: true } }),
    db.party.groupBy({ by: ["businessId"], where: { businessId: { in: ids } }, _count: true }),
    db.invoice.groupBy({ by: ["businessId"], where: { businessId: { in: ids } }, _count: true }),
    db.ledgerEntry.groupBy({ by: ["businessId"], where: { businessId: { in: ids }, source: { notIn: ["REVERSAL", "OPENING"] } }, _count: true }),
  ]);
  const m = (rows: { businessId: string | null; _count: number }[]) => new Map(rows.map((r) => [r.businessId, r._count]));
  const seenBy = new Map(seen.map((r) => [r.businessId, r._max.lastActiveAt]));
  const pc = m(parties), bc = m(bills), ec = m(entries);

  const rows: ShopRow[] = businesses.map((b) => {
    const owner = b.memberships.filter((x) => x.role === "OWNER").sort((a, c) => a.createdAt.getTime() - c.createdAt.getTime())[0]?.user;
    return {
      id: b.id, name: b.name, createdAt: b.createdAt, owner: owner?.name ?? "—", ownerPhone: owner?.phone ?? null, ownerEmail: owner?.email ?? null,
      lastActive: seenBy.get(b.id) ?? null, parties: pc.get(b.id) ?? 0, bills: bc.get(b.id) ?? 0, entries: ec.get(b.id) ?? 0, credits: b.creditBalance, members: b.memberships.length,
    };
  });
  const cmp: Record<typeof opts.sort, (a: ShopRow, b: ShopRow) => number> = {
    new: (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    active: (a, b) => (b.lastActive?.getTime() ?? 0) - (a.lastActive?.getTime() ?? 0),
    busy: (a, b) => b.entries + b.bills - (a.entries + a.bills),
    name: (a, b) => a.name.localeCompare(b.name),
  };
  rows.sort(cmp[opts.sort]);
  const total = rows.length;
  return { total, rows: rows.slice((opts.page - 1) * PAGE_SIZE, opts.page * PAGE_SIZE) };
}

export async function shopDetail(id: string) {
  const b = await db.business.findUnique({
    where: { id },
    include: { memberships: { include: { user: { select: { id: true, name: true, phone: true, email: true, googleSub: true, createdAt: true } } }, orderBy: { createdAt: "asc" } } },
  });
  if (!b) return null;
  const since14 = ago(14);
  const [parties, suppliers, invoices, quotes, orders, items, entries, msgs, failed, pays, sessions, entSeries, billSeries, referred, branches] = await Promise.all([
    db.party.count({ where: { businessId: id, type: { in: ["CUSTOMER", "BOTH"] } } }),
    db.party.count({ where: { businessId: id, type: { in: ["SUPPLIER", "BOTH"] } } }),
    db.invoice.count({ where: { businessId: id } }),
    db.quote.count({ where: { businessId: id } }),
    db.order.count({ where: { businessId: id } }),
    db.item.count({ where: { businessId: id, archivedAt: null } }),
    db.ledgerEntry.count({ where: { businessId: id, source: { notIn: ["REVERSAL", "OPENING"] } } }),
    db.message.groupBy({ by: ["status"], where: { businessId: id, createdAt: { gte: ago(30) } }, _count: true }),
    db.message.findMany({ where: { businessId: id, status: { in: ["FAILED", "SKIPPED"] } }, orderBy: { createdAt: "desc" }, take: 8, select: { id: true, kind: true, channel: true, status: true, error: true, createdAt: true } }),
    db.payment.groupBy({ by: ["status"], where: { businessId: id }, _count: true, _sum: { amountPaise: true } }),
    db.session.groupBy({ by: ["userId"], where: { businessId: id }, _max: { lastActiveAt: true } }),
    db.$queryRaw<{ day: Date; n: bigint }[]>`SELECT date_trunc('day', "createdAt" AT TIME ZONE 'Asia/Kolkata') AS day, count(*) AS n FROM "LedgerEntry" WHERE "businessId" = ${id} AND "createdAt" >= ${since14} AND "source" NOT IN ('REVERSAL','OPENING') GROUP BY 1`,
    db.$queryRaw<{ day: Date; n: bigint }[]>`SELECT date_trunc('day', "createdAt" AT TIME ZONE 'Asia/Kolkata') AS day, count(*) AS n FROM "Invoice" WHERE "businessId" = ${id} AND "createdAt" >= ${since14} GROUP BY 1`,
    db.business.count({ where: { referredById: id } }),
    db.branch.count({ where: { businessId: id, archivedAt: null } }),
  ]);
  const lastBy = new Map(sessions.map((s) => [s.userId, s._max.lastActiveAt]));
  return {
    business: b,
    members: b.memberships.map((m) => ({ role: m.role, user: m.user, lastActive: lastBy.get(m.userId) ?? null })),
    counts: { parties, suppliers, invoices, quotes, orders, items, entries, branches, referred },
    messages: Object.fromEntries(msgs.map((m) => [m.status, m._count])) as Record<string, number>,
    failed,
    payments: pays.map((p) => ({ status: p.status, count: p._count, paise: Number(p._sum.amountPaise ?? 0n) })),
    entriesSeries: fill(entSeries, 14), billsSeries: fill(billSeries, 14),
    lastActive: sessions.reduce<Date | null>((m, s) => (s._max.lastActiveAt && (!m || s._max.lastActiveAt > m) ? s._max.lastActiveAt : m), null),
  };
}

export type UserRow = { id: string; name: string | null; phone: string | null; email: string | null; google: boolean; createdAt: Date; lastActive: Date | null; shops: { id: string; name: string; role: string }[] };

export async function usersList(opts: { q: string; page: number }) {
  const q = opts.q.trim();
  const digits = q.replace(/\D/g, "");
  const where = q ? { OR: [{ name: { contains: q, mode: "insensitive" as const } }, { email: { contains: q, mode: "insensitive" as const } }, ...(digits ? [{ phone: { contains: digits } }] : [])] } : {};
  const [total, users] = await Promise.all([
    db.user.count({ where }),
    db.user.findMany({
      where, orderBy: { createdAt: "desc" }, skip: (opts.page - 1) * PAGE_SIZE, take: PAGE_SIZE,
      include: { memberships: { select: { role: true, business: { select: { id: true, name: true } } } } },
    }),
  ]);
  const seen = await db.session.groupBy({ by: ["userId"], where: { userId: { in: users.map((u) => u.id) } }, _max: { lastActiveAt: true } });
  const lastBy = new Map(seen.map((s) => [s.userId, s._max.lastActiveAt]));
  const rows: UserRow[] = users.map((u) => ({
    id: u.id, name: u.name, phone: u.phone, email: u.email, google: !!u.googleSub, createdAt: u.createdAt, lastActive: lastBy.get(u.id) ?? null,
    shops: u.memberships.map((m) => ({ id: m.business.id, name: m.business.name, role: m.role })),
  }));
  return { total, rows };
}
