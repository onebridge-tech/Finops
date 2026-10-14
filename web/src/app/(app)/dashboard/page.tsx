import Link from "next/link";
import type { ReactNode } from "react";
import { can, requireBusiness } from "@/lib/auth";
import { dashboard } from "@/lib/queries";
import { formatINR } from "@/lib/money";
import { translator } from "@/lib/i18n";
import { drCr } from "@/lib/accounting";
import { parseTiles, TILES, type TileId } from "@/lib/tiles";
import { Avatar, Card, EmptyState, LinkButton, PageHeader, SectionTitle, StatCard, fmtDate } from "@/components/ui";
import { Icon } from "@/components/icon";
import { CustomizeTiles } from "./customize";

export const metadata = { title: "Home" };

const istHour = () => Number(new Date().toLocaleString("en-GB", { hour: "2-digit", hour12: false, timeZone: "Asia/Kolkata" }));
const compact = (paise: number) => {
  const r = paise / 100;
  return r >= 1e7 ? `${(r / 1e7).toFixed(1)}Cr` : r >= 1e5 ? `${(r / 1e5).toFixed(1)}L` : r >= 1e3 ? `${(r / 1e3).toFixed(1)}k` : String(Math.round(r));
};

export default async function Dashboard() {
  const ctx = await requireBusiness();
  const { business, role, user } = ctx;
  const d = await dashboard(ctx);
  const t = translator(user.uiLanguage);
  const accountant = user.uiMode === "ACCOUNTANT";
  const english = user.uiLanguage === "en";
  const hour = istHour();
  const first = (user.name ?? "").split(" ")[0];
  const greeting = english ? `${hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening"}${first ? `, ${first}` : ""}` : t("dash.today");

  // Team activity is for managers; the GST tile only makes sense to people who see reports.
  const available = (Object.keys(TILES) as TileId[]).filter((id) =>
    (id !== "team" || can(role, "team:manage")) && (id !== "gstMonth" || can(role, "reports:view")));
  const saved = parseTiles(ctx.membership.dashboardTiles);
  const tiles = (ctx.membership.dashboardTiles ? saved : accountant && can(role, "reports:view") ? [...saved.slice(0, 4), "gstMonth" as TileId, ...saved.slice(4)] : saved)
    .filter((id) => available.includes(id));

  const stats: Partial<Record<TileId, ReactNode>> = {
    toCollect: <StatCard icon="wallet" label={accountant ? "Sundry Debtors" : t("dash.toCollect")} value={accountant ? drCr(d.toCollect) : formatINR(d.toCollect)} tone="gave" href="/parties?type=customers" />,
    overdue: <StatCard icon="warning" label={t("dash.overdue")} value={formatINR(d.overdueTotal)} tone={d.overdueTotal > 0 ? "gave" : undefined} href="/collections" />,
    toPay: <StatCard icon="send" label={accountant ? "Sundry Creditors" : t("dash.toPay")} value={accountant ? drCr(-d.toPay) : formatINR(d.toPay)} tone="got" href="/parties?type=suppliers" />,
    collectedToday: <StatCard icon="trend" label={t("dash.collectedToday")} value={formatINR(d.todayGot)} tone="got" hint={`Cash ${formatINR(d.cashToday)} · UPI ${formatINR(d.upiToday)}`} />,
    cashToday: <StatCard icon="wallet" label={t("dash.cashToday")} value={formatINR(d.cashToday)} />,
    creditToday: <StatCard icon="arrowUp" label={t("dash.creditToday")} value={formatINR(d.todayGave)} tone="gave" />,
    followUpsDue: <StatCard icon="phone" label={t("dash.followUpsDue")} value={String(d.followUpsDue)} tone={d.followUpsDue > 0 ? "gave" : undefined} href="/follow-ups" />,
    openQuotes: <StatCard icon="note" label={t("dash.quotesOpen")} value={formatINR(d.openQuotes.totalPaise)} hint={`${d.openQuotes.count} quotation${d.openQuotes.count === 1 ? "" : "s"}`} href="/quotes" />,
    gstMonth: (
      <StatCard icon="bill" label="Output GST this month" value={formatINR(d.gstMonth.cgst + d.gstMonth.sgst + d.gstMonth.igst)}
        hint={`${d.gstMonth.invoices} invoices · taxable ${formatINR(d.gstMonth.taxable)}`} />
    ),
  };

  const lists: Partial<Record<TileId, ReactNode>> = {
    topOverdue: (
      <section>
        <SectionTitle action={d.overdue.length > 0 ? <Link href="/collections" className="text-sm font-medium text-brand hover:underline">See all</Link> : undefined}>{t("dash.topOverdue")}</SectionTitle>
        {d.overdue.length === 0 ? (
          <EmptyState icon="check" title={t("dash.nothingOverdue")}>{d.partyCount === 0 ? t("dash.firstCustomer") : t("dash.allWithin")}</EmptyState>
        ) : (
          <Card className="divide-y divide-line p-0 sm:p-0">
            {d.overdue.map((p) => (
              <Link key={p.id} href={`/parties/${p.id}`} className="flex items-center gap-3 px-4 py-3 transition hover:bg-bg">
                <Avatar name={p.name} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{p.name}</span>
                  <span className="text-xs text-muted">{t("dash.ofDue", { amount: formatINR(p.balance) })}</span>
                </span>
                <span className="font-semibold tabular-nums text-gave">{formatINR(p.overdue)}</span>
              </Link>
            ))}
          </Card>
        )}
      </section>
    ),
    recent: (
      <section>
        <SectionTitle>{t("dash.recent")}</SectionTitle>
        {d.recent.length === 0 ? (
          <EmptyState icon="note" title={t("dash.noEntries")} />
        ) : (
          <Card className="divide-y divide-line p-0 sm:p-0">
            {d.recent.map((e) => (
              <Link key={e.id} href={`/parties/${e.partyId}`} className="flex items-center gap-3 px-4 py-3 transition hover:bg-bg">
                <span className={`flex size-9 shrink-0 items-center justify-center rounded-full ${e.direction === "GAVE" ? "bg-gave/10 text-gave" : "bg-got/10 text-got"}`}>
                  <Icon name={e.direction === "GAVE" ? "arrowUp" : "arrowDown"} size={16} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{e.party.name}</span>
                  <span className="block truncate text-xs text-muted">{fmtDate(e.date)} · {e.note ?? t(e.direction === "GAVE" ? "col.gave" : "col.got")}</span>
                </span>
                <span className="text-right">
                  <span className={`block font-semibold tabular-nums ${e.direction === "GAVE" ? "text-gave" : "text-got"}`}>{formatINR(e.amountPaise)}</span>
                  <span className="text-xs text-muted">{accountant ? (e.direction === "GAVE" ? "Dr" : "Cr") : t(e.direction === "GAVE" ? "col.gave" : "col.got")}</span>
                </span>
              </Link>
            ))}
          </Card>
        )}
      </section>
    ),
    team: (
      <section>
        <SectionTitle>{t("dash.team")}</SectionTitle>
        {d.activity.length === 0 ? (
          <EmptyState icon="users" title={t("dash.noEntries")} />
        ) : (
          <Card className="divide-y divide-line p-0 sm:p-0">
            {d.activity.map((a) => (
              <div key={a.userId} className="flex items-center gap-3 px-4 py-3">
                <Avatar name={a.name} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{a.name}</span>
                  <span className="text-xs capitalize text-muted">{a.role.toLowerCase()} · {a.entries} entries</span>
                </span>
                <span className="text-right">
                  <span className="block font-semibold tabular-nums text-got">{formatINR(a.collected)}</span>
                  <span className="text-xs tabular-nums text-muted">Gave {formatINR(a.gave)}</span>
                </span>
              </div>
            ))}
          </Card>
        )}
      </section>
    ),
  };

  const statTiles = tiles.filter((id) => TILES[id].kind === "stat");
  const listTiles = tiles.filter((id) => TILES[id].kind === "list");
  const max = Math.max(1, ...d.week.flatMap((w) => [w.got, w.gave]));
  const weekTotal = d.week.reduce((s, w) => s + w.got, 0);
  const steps = [
    { done: d.partyCount > 0, label: "Add your first customer", href: "/parties/new", show: can(role, "party:write") },
    { done: !!business.upiId, label: "Add your UPI ID so customers can pay you", href: "/settings", show: can(role, "settings:write") },
  ].filter((s) => s.show);
  const onboarding = steps.length > 0 && steps.some((s) => !s.done);

  return (
    <>
      <PageHeader
        title={greeting}
        sub={`${business.name} · ${new Date().toLocaleDateString(english ? "en-IN" : `${user.uiLanguage}-IN`, { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Kolkata" })}`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            {can(role, "invoice:write") && <LinkButton href="/invoices/new" variant="secondary"><Icon name="bill" size={16} />{t("dash.newInvoice")}</LinkButton>}
            {can(role, "ledger:write") && <LinkButton href="/parties"><Icon name="plus" size={16} />{t("dash.writeEntry")}</LinkButton>}
          </div>
        }
      />

      {onboarding && (
        <Card className="mb-6 border-brand/30 bg-brand-soft">
          <p className="font-semibold">Get started in two steps</p>
          <ul className="mt-3 space-y-2">
            {steps.map((s) => (
              <li key={s.label}>
                <Link href={s.href} className={`flex items-center gap-3 rounded-lg bg-card px-3 py-2.5 shadow-[var(--shadow)] ${s.done ? "text-muted" : "hover:ring-1 hover:ring-brand/40"}`}>
                  <span className={`flex size-6 items-center justify-center rounded-full ${s.done ? "bg-got text-white" : "border-2 border-line"}`}>{s.done && <Icon name="check" size={14} />}</span>
                  <span className={`flex-1 ${s.done ? "line-through" : "font-medium"}`}>{s.label}</span>
                  {!s.done && <Icon name="chevron" size={16} className="text-muted" />}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="mb-3 flex justify-end">
        <CustomizeTiles current={tiles} available={available} label={t("dash.customize")} />
      </div>

      {statTiles.length > 0 && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {statTiles.map((id) => <div key={id} className={id === "gstMonth" ? "col-span-2" : ""}>{stats[id]}</div>)}
        </div>
      )}

      <Card className="mt-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold tracking-tight">Last 7 days</h2>
            <p className="text-sm text-muted">Money received: <span className="font-semibold text-got">{formatINR(weekTotal)}</span></p>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted">
            <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-got" />Received</span>
            <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-gave/70" />Given on credit</span>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-7 gap-2 sm:gap-4" role="img" aria-label="Money received and credit given over the last seven days">
          {d.week.map((w) => (
            <div key={w.day} className="flex flex-col items-center gap-2">
              <div className="flex h-32 w-full items-end justify-center gap-1">
                <div className="w-full max-w-4 rounded-t bg-got" style={{ height: `${Math.max(w.got ? 4 : 0, (w.got / max) * 100)}%` }} title={`Received ${formatINR(w.got)}`} />
                <div className="w-full max-w-4 rounded-t bg-gave/70" style={{ height: `${Math.max(w.gave ? 4 : 0, (w.gave / max) * 100)}%` }} title={`Given ${formatINR(w.gave)}`} />
              </div>
              <span className="text-xs text-muted">{new Date(`${w.day}T12:00:00+05:30`).toLocaleDateString("en-IN", { weekday: "short", timeZone: "Asia/Kolkata" })}</span>
              <span className="-mt-1.5 text-[11px] tabular-nums text-muted/80">{w.got || w.gave ? compact(w.got || w.gave) : ""}</span>
            </div>
          ))}
        </div>
      </Card>

      {listTiles.length > 0 && (
        <div className="mt-8 grid gap-8 lg:grid-cols-2">
          {listTiles.map((id) => <div key={id}>{lists[id]}</div>)}
        </div>
      )}
    </>
  );
}
