import "server-only";
import { db } from "./db";
import { isTestMode, providerName } from "./messaging/providers";
import { gatewayMode } from "./payments/gateway";
import { googleEnabled } from "./google";
import { istDay } from "./ledger";

// Health, growth and error numbers for the platform admin area (Stage C). Counts only.

const DAY = 86_400_000;
const ago = (days: number) => new Date(Date.now() - days * DAY);

// ── Health ──────────────────────────────────────────────────────────────────

export const JOBS = [
  { name: "hourly", label: "Reminders, daily summary and tasks", every: 60 * 60 * 1000, flag: "REMINDER_SCHEDULER" },
  { name: "backup", label: "Daily backup", every: 24 * 60 * 60 * 1000, flag: "BACKUP_SCHEDULER" },
] as const;

export async function health() {
  const [dbSize, sessions, ...tables] = await Promise.all([
    db.$queryRaw<{ bytes: bigint }[]>`SELECT pg_database_size(current_database()) AS bytes`,
    db.session.count({ where: { revokedAt: null, expiresAt: { gt: new Date() } } }),
    db.business.count(), db.user.count(), db.party.count(), db.ledgerEntry.count(), db.invoice.count(), db.message.count(), db.auditEvent.count(), db.storedFile.count(),
  ]);
  const names = ["Shops", "People", "Customers & suppliers", "Entries", "Bills", "Messages", "Audit events", "Uploaded files"];

  const jobs = await Promise.all(
    JOBS.map(async (j) => {
      const [last, lastOk] = await Promise.all([
        db.jobRun.findFirst({ where: { name: j.name }, orderBy: { startedAt: "desc" } }),
        db.jobRun.findFirst({ where: { name: j.name, ok: true }, orderBy: { startedAt: "desc" } }),
      ]);
      const schedulerOn = process.env[j.flag] === "1";
      const late = !lastOk || Date.now() - lastOk.startedAt.getTime() > j.every * 2.5;
      return { ...j, last, lastOk, schedulerOn, late };
    }),
  );

  const msgs = await db.message.groupBy({ by: ["channel", "status"], where: { createdAt: { gte: ago(7) } }, _count: true });
  const waiting = await db.message.count({ where: { channel: "WHATSAPP_LINK", status: "QUEUED" } });
  const channels = (["WHATSAPP_LINK", "SMS", "EMAIL"] as const).map((c) => {
    const rows = msgs.filter((m) => m.channel === c);
    const n = (...s: string[]) => rows.filter((r) => s.includes(r.status)).reduce((t, r) => t + r._count, 0);
    const ok = n("SENT", "DELIVERED", "READ");
    const failed = n("FAILED");
    if (c === "WHATSAPP_LINK") return { channel: c, provider: "click-to-chat", test: false, ok, failed: 0, skipped: n("SKIPPED"), rate: null as number | null, waiting };
    return { waiting: 0, channel: c, provider: providerName(c), test: isTestMode(c), ok, failed, skipped: n("SKIPPED"), rate: ok + failed === 0 ? null : Math.round((ok / (ok + failed)) * 100) };
  });

  const pay = gatewayMode();
  return {
    build: {
      commit: (process.env.RENDER_GIT_COMMIT ?? "").slice(0, 7) || null,
      service: process.env.RENDER_SERVICE_NAME ?? null,
      node: process.version,
      uptimeMin: Math.round(process.uptime() / 60),
      env: process.env.NODE_ENV,
    },
    database: { bytes: Number(dbSize[0]?.bytes ?? 0n), sessions, tables: names.map((n, i) => ({ name: n, count: tables[i] as number })) },
    jobs,
    channels,
    integrations: [
      { name: "Payments", state: pay === null ? "Off" : pay === "test" ? "Test mode" : `Live (${pay})`, live: pay !== null && pay !== "test" },
      { name: "Sign in with Google", state: googleEnabled() ? "On" : "Not set up", live: googleEnabled() },
      { name: "Sign-in codes on screen", state: process.env.OTP_DEV_MODE === "1" ? "ON — anyone can sign in as anyone" : "Off", live: process.env.OTP_DEV_MODE !== "1", warn: process.env.OTP_DEV_MODE === "1" },
      { name: "Backup key", state: process.env.BACKUP_KEY ? "Set" : "Not set", live: !!process.env.BACKUP_KEY },
      { name: "Cron secret", state: process.env.CRON_SECRET ? "Set" : "Not set", live: !!process.env.CRON_SECRET },
    ],
  };
}

// ── Errors ──────────────────────────────────────────────────────────────────

export async function errorsList(view: "open" | "resolved") {
  const [rows, last24, openCount] = await Promise.all([
    db.errorLog.findMany({ where: view === "open" ? { resolvedAt: null } : { resolvedAt: { not: null } }, orderBy: { lastSeenAt: "desc" }, take: 100 }),
    db.errorLog.aggregate({ where: { lastSeenAt: { gte: ago(1) }, resolvedAt: null }, _count: true, _sum: { count: true } }),
    db.errorLog.count({ where: { resolvedAt: null } }),
  ]);
  return { rows, kinds24h: last24._count, openCount };
}

export async function openErrorCount24h(): Promise<number> {
  return db.errorLog.count({ where: { resolvedAt: null, lastSeenAt: { gte: ago(1) } } });
}

// ── Growth ──────────────────────────────────────────────────────────────────

const weekStartIST = (d: Date) => {
  const ymd = istDay(d);
  const noon = new Date(`${ymd}T12:00:00+05:30`);
  const dow = (noon.getUTCDay() + 6) % 7; // Monday = 0
  return istDay(new Date(noon.getTime() - dow * DAY));
};
const weeksBetween = (a: string, b: string) => Math.round((new Date(`${b}T12:00:00+05:30`).getTime() - new Date(`${a}T12:00:00+05:30`).getTime()) / (7 * DAY));

export type Cohort = { week: string; shops: number; customer: number; bill: number; message: number; retention: (number | null)[] };

export async function growth() {
  const WEEKS = 8;
  const since = new Date(`${weekStartIST(ago((WEEKS - 1) * 7))}T00:00:00+05:30`);
  const shops = await db.business.findMany({ where: { createdAt: { gte: since } }, select: { id: true, createdAt: true } });
  const ids = shops.map((s) => s.id);
  const thisWeek = weekStartIST(new Date());

  const [withCustomer, withBill, withMessage, entryWeeks, billWeeks] = ids.length
    ? await Promise.all([
        db.party.groupBy({ by: ["businessId"], where: { businessId: { in: ids } } }),
        db.invoice.groupBy({ by: ["businessId"], where: { businessId: { in: ids } } }),
        db.message.groupBy({ by: ["businessId"], where: { businessId: { in: ids }, provider: { not: "link" } } }),
        db.$queryRaw<{ id: string; w: Date }[]>`SELECT DISTINCT "businessId" AS id, date_trunc('week', "createdAt" AT TIME ZONE 'Asia/Kolkata') AS w FROM "LedgerEntry" WHERE "businessId" = ANY(${ids}::text[]) AND "createdAt" >= ${since}`,
        db.$queryRaw<{ id: string; w: Date }[]>`SELECT DISTINCT "businessId" AS id, date_trunc('week', "createdAt" AT TIME ZONE 'Asia/Kolkata') AS w FROM "Invoice" WHERE "businessId" = ANY(${ids}::text[]) AND "createdAt" >= ${since}`,
      ])
    : [[], [], [], [], []];

  const has = (rows: { businessId: string }[]) => new Set(rows.map((r) => r.businessId));
  const c = has(withCustomer as { businessId: string }[]), b = has(withBill as { businessId: string }[]), m = has(withMessage as { businessId: string }[]);
  // The week of each recorded action, as the Monday date, per shop.
  const active = new Map<string, Set<string>>();
  for (const r of [...(entryWeeks as { id: string; w: Date }[]), ...(billWeeks as { id: string; w: Date }[])]) {
    const w = r.w.toISOString().slice(0, 10);
    (active.get(r.id) ?? active.set(r.id, new Set()).get(r.id)!).add(w);
  }

  const cohorts: Cohort[] = Array.from({ length: WEEKS }, (_, i) => {
    const week = weekStartIST(ago((WEEKS - 1 - i) * 7));
    const mine = shops.filter((s) => weekStartIST(s.createdAt) === week);
    const maxK = weeksBetween(week, thisWeek);
    const retention = Array.from({ length: Math.min(WEEKS, 5) }, (_, k) =>
      k > maxK || mine.length === 0 ? null : Math.round((mine.filter((s) => active.get(s.id)?.has(addWeeks(week, k))).length / mine.length) * 100),
    );
    return { week, shops: mine.length, customer: mine.filter((s) => c.has(s.id)).length, bill: mine.filter((s) => b.has(s.id)).length, message: mine.filter((s) => m.has(s.id)).length, retention };
  });

  // Which parts of the product are used, over the last 30 days: how many shops used each at least once.
  const since30 = ago(30);
  const distinct = async (label: string, q: Promise<{ businessId: string }[]>) => ({ label, shops: (await q).length });
  const gb = (model: { groupBy: (a: never) => Promise<{ businessId: string }[]> }, where: object) => model.groupBy({ by: ["businessId"], where } as never);
  const features = await Promise.all([
    distinct("Writing credit and payments", gb(db.ledgerEntry as never, { createdAt: { gte: since30 }, source: { notIn: ["REVERSAL", "OPENING"] } })),
    distinct("Making bills", gb(db.invoice as never, { createdAt: { gte: since30 } })),
    distinct("Price quotes", gb(db.quote as never, { createdAt: { gte: since30 } })),
    distinct("Orders", gb(db.order as never, { createdAt: { gte: since30 } })),
    distinct("Return notes", gb(db.note as never, { createdAt: { gte: since30 } })),
    distinct("Shop expenses", gb(db.expense as never, { createdAt: { gte: since30 } })),
    distinct("Stock changes", gb(db.stockMovement as never, { createdAt: { gte: since30 } })),
    distinct("Receipts", gb(db.receipt as never, { createdAt: { gte: since30 } })),
    distinct("Reminders and messages", gb(db.message as never, { createdAt: { gte: since30 }, provider: { not: "link" } })),
    distinct("Calls (follow-ups)", gb(db.followUp as never, { createdAt: { gte: since30 } })),
    distinct("Promises to pay", gb(db.promiseToPay as never, { createdAt: { gte: since30 } })),
    distinct("Field visits", gb(db.visit as never, { createdAt: { gte: since30 } })),
    distinct("Online payments", gb(db.payment as never, { createdAt: { gte: since30 }, status: "PAID" })),
  ]);

  const [total, upi, gstin, reminders, catalogue, tally, multi] = await Promise.all([
    db.business.count(), db.business.count({ where: { upiId: { not: null } } }), db.business.count({ where: { gstin: { not: null } } }),
    db.business.count({ where: { reminderEnabled: true } }), db.business.count({ where: { catalogEnabled: true } }), db.business.count({ where: { tallyLastSyncAt: { not: null } } }),
    db.membership.groupBy({ by: ["businessId"], _count: true }).then((g) => g.filter((x) => x._count > 1).length),
  ]);
  const setup = [
    { label: "UPI ID added", n: upi }, { label: "GSTIN added", n: gstin }, { label: "Automatic reminders on", n: reminders },
    { label: "Item list shared", n: catalogue }, { label: "Tally connected", n: tally }, { label: "More than one person", n: multi },
  ];
  return { cohorts, features: features.sort((a, b) => b.shops - a.shops), setup, total };
}

function addWeeks(ymd: string, k: number) {
  return istDay(new Date(new Date(`${ymd}T12:00:00+05:30`).getTime() + k * 7 * DAY));
}
