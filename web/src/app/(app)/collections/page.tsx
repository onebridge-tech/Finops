import Link from "next/link";
import { can, requireBusiness } from "@/lib/auth";
import { translator } from "@/lib/i18n";
import { collections } from "@/lib/queries";
import { AGEING_BUCKETS, daysBetween, istDay, type AgeingBucket } from "@/lib/ledger";
import { blockedReason } from "@/lib/messaging/send";
import { formatINR } from "@/lib/money";
import { Card, EmptyState, PageHeader, fmtDate } from "@/components/ui";
import { BulkReminderForm } from "./bulk-form";

export const metadata = { title: "Collections" };

const VIEWS = [
  ["overdue", "collect.overdue"],
  ["today", "collect.today"],
  ["upcoming", "collect.week"],
  ["all", "collect.all"],
] as const;

export default async function Collections({ searchParams }: PageProps<"/collections">) {
  const sp = await searchParams;
  const view = (VIEWS.find(([v]) => v === sp.view)?.[0] ?? "overdue") as (typeof VIEWS)[number][0];
  const bucket = AGEING_BUCKETS.includes(sp.bucket as AgeingBucket) ? (sp.bucket as AgeingBucket) : null;
  const ctx = await requireBusiness();
  const { business, role } = ctx;
  const t = translator(ctx.user.uiLanguage);
  const all = await collections(ctx);
  const today = new Date();

  const rows = all
    .map((p) => {
      const dueToday = p.dues.filter((d) => istDay(d.due) === istDay(today)).reduce((s, d) => s + d.open, 0);
      const upcoming = p.dues.filter((d) => { const n = daysBetween(today, d.due); return n >= 0 && n <= 7; });
      const next = p.dues.filter((d) => daysBetween(today, d.due) >= 0).sort((a, b) => a.due.getTime() - b.due.getTime())[0];
      return { ...p, dueToday, upcomingAmount: upcoming.reduce((s, d) => s + d.open, 0), nextDue: next?.due ?? null };
    })
    .filter((p) => {
      if (view === "overdue") return bucket ? p.ageing[bucket] > 0 : p.overdue > 0;
      if (view === "today") return p.dueToday > 0;
      if (view === "upcoming") return p.upcomingAmount > 0;
      return true;
    })
    .sort((a, b) => (view === "overdue" ? b.overdue - a.overdue : (a.nextDue?.getTime() ?? 0) - (b.nextDue?.getTime() ?? 0)));

  const totals = AGEING_BUCKETS.map((k) => [k, all.reduce((s, p) => s + p.ageing[k], 0)] as const);
  const amountFor = (p: (typeof rows)[number]) =>
    view === "overdue" ? (bucket ? p.ageing[bucket] : p.overdue) : view === "today" ? p.dueToday : view === "upcoming" ? p.upcomingAmount : p.balance;

  const href = (q: Record<string, string | null>) => {
    const s = new URLSearchParams(Object.entries({ view, bucket, ...q }).filter(([, v]) => v) as [string, string][]);
    return `/collections?${s}`;
  };

  return (
    <>
      <PageHeader title={t("collect.title")} sub={t("collect.sub")} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {totals.map(([k, v]) => (
          <Link key={k} href={href({ view: "overdue", bucket: bucket === k ? null : k })}>
            <Card className={`hover:bg-bg ${bucket === k && view === "overdue" ? "border-brand" : ""}`}>
              <p className="text-sm text-muted">{t("collect.daysOverdue", { range: k })}</p>
              <p className="mt-1 text-xl font-semibold tabular-nums text-gave">{formatINR(v)}</p>
            </Card>
          </Link>
        ))}
      </div>

      <nav className="mt-5 flex w-fit max-w-full flex-wrap gap-1 rounded-lg bg-line/50 p-1">
        {VIEWS.map(([v, label]) => (
          <Link key={v} href={href({ view: v, bucket: v === "overdue" ? bucket : null })}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${view === v ? "bg-card text-ink shadow-sm" : "text-muted hover:text-ink"}`}>
            {t(label)}
          </Link>
        ))}
      </nav>

      <div className="mt-4">
        {rows.length === 0 ? (
          <EmptyState title="Nothing here">Nobody here yet.</EmptyState>
        ) : can(role, "reminder:send") ? (
          <BulkReminderForm
            credits={business.creditBalance}
            rows={rows.map((p) => ({
              id: p.id, name: p.name, amount: formatINR(amountFor(p)), balance: formatINR(p.balance),
              nextDue: p.nextDue ? fmtDate(p.nextDue) : null,
              blocked: { WHATSAPP: blockedReason(p, "WHATSAPP"), SMS: blockedReason(p, "SMS"), EMAIL: blockedReason(p, "EMAIL") },
            }))}
          />
        ) : (
          <Card className="divide-y divide-line p-0 text-sm">
            {rows.map((p) => (
              <Link key={p.id} href={`/parties/${p.id}`} className="flex justify-between px-4 py-3 hover:bg-bg">
                <span>{p.name}</span><span className="tabular-nums text-gave">{formatINR(amountFor(p))}</span>
              </Link>
            ))}
          </Card>
        )}
      </div>
    </>
  );
}
