import Link from "next/link";
import { partyWhere, requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import { daysBetween } from "@/lib/ledger";
import { teamOptions } from "@/lib/team";
import { translator } from "@/lib/i18n";
import { Card, EmptyState, PageHeader, fmtDate } from "@/components/ui";
import { CompleteFollowUp } from "@/components/follow-up-forms";

export const metadata = { title: "Follow-ups" };

const VIEWS = [["due", "fu.due"], ["upcoming", "fu.upcoming"], ["done", "fu.done"]] as const;

export default async function FollowUps({ searchParams }: PageProps<"/follow-ups">) {
  const sp = await searchParams;
  const view = VIEWS.find(([v]) => v === sp.view)?.[0] ?? "due";
  const ctx = await requireBusiness();
  const t = translator(ctx.user.uiLanguage);
  // Reps only ever see their own; others can switch between mine and everyone's.
  const mine = ctx.assignedOnly || sp.who !== "all";
  const endOfToday = new Date(`${new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" })}T23:59:59+05:30`);

  const rows = await db.followUp.findMany({
    where: {
      businessId: ctx.business.id,
      party: partyWhere(ctx),
      ...(mine ? { assignedToId: ctx.user.id } : {}),
      ...(view === "done" ? { doneAt: { not: null } } : { doneAt: null, dueAt: view === "due" ? { lte: endOfToday } : { gt: endOfToday } }),
    },
    orderBy: view === "done" ? { doneAt: "desc" } : { dueAt: "asc" },
    take: 200,
    include: { party: { select: { id: true, name: true, phone: true, type: true } } },
  });
  const team = new Map((await teamOptions(ctx.business.id)).map((t) => [t.id, t.name]));
  const href = (q: Record<string, string>) => `/follow-ups?${new URLSearchParams({ view, ...(mine ? {} : { who: "all" }), ...q })}`;
  const now = new Date();

  return (
    <>
      <PageHeader title={t("fu.title")} sub="Calls and visits to make: money to ask for, and people who may become customers." />
      <nav className="mb-5 flex w-fit max-w-full flex-wrap items-center gap-1 rounded-lg bg-line/50 p-1">
        {VIEWS.map(([v, label]) => (
          <Link key={v} href={href({ view: v })} className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${view === v ? "bg-card text-ink shadow-sm" : "text-muted hover:text-ink"}`}>{t(label)}</Link>
        ))}
        {!ctx.assignedOnly && (
          <span className="ml-auto flex gap-1">
            <Link href={`/follow-ups?${new URLSearchParams({ view })}`} className={`rounded-lg px-3 py-1.5 ${mine ? "bg-card font-medium" : "text-muted"}`}>{t("fu.mine")}</Link>
            <Link href={`/follow-ups?${new URLSearchParams({ view, who: "all" })}`} className={`rounded-lg px-3 py-1.5 ${!mine ? "bg-card font-medium" : "text-muted"}`}>{t("fu.everyone")}</Link>
          </span>
        )}
      </nav>
      {rows.length === 0 ? (
        <EmptyState icon="phone" title={view === "due" ? "No calls to make today" : "Nothing here"}>Add a call from any customer’s page.</EmptyState>
      ) : (
        <Card className="divide-y divide-line p-0 text-sm">
          {rows.map((f) => {
            const late = !f.doneAt ? -daysBetween(now, f.dueAt) : 0;
            return (
              <div key={f.id} className="px-4 py-3">
                <p className="flex flex-wrap justify-between gap-2">
                  <span>
                    <Link href={`/parties/${f.party.id}`} className="font-medium hover:underline">{f.party.name}</Link>
                    {f.party.type === "LEAD" && <span className="ml-2 rounded bg-brand/10 px-1.5 text-xs text-brand">{t("type.LEAD")}</span>}
                    <span className="block">{f.note}</span>
                  </span>
                  <span className={`text-xs ${late > 0 ? "font-medium text-gave" : "text-muted"}`}>
                    {f.doneAt ? `done ${fmtDate(f.doneAt)}` : late > 0 ? `${late} day${late === 1 ? "" : "s"} overdue` : fmtDate(f.dueAt)}
                    {!mine && ` · ${team.get(f.assignedToId) ?? "former member"}`}
                    {f.party.phone && !f.doneAt && <> · <a href={`tel:+${f.party.phone}`} className="text-brand underline">{t("fu.call")}</a></>}
                  </span>
                </p>
                {f.outcome && <p className="text-xs text-muted">Outcome: {f.outcome}</p>}
                {!f.doneAt && <CompleteFollowUp id={f.id} />}
              </div>
            );
          })}
        </Card>
      )}
    </>
  );
}
