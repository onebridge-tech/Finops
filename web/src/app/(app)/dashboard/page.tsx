import Link from "next/link";
import type { ReactNode } from "react";
import { can, requireBusiness } from "@/lib/auth";
import { dashboard } from "@/lib/queries";
import { formatINR } from "@/lib/money";
import { translator } from "@/lib/i18n";
import { drCr } from "@/lib/accounting";
import { parseTiles, TILES, type TileId } from "@/lib/tiles";
import { Card, EmptyState, PageHeader, fmtDate } from "@/components/ui";
import { Icon, type IconName } from "@/components/icon";
import { CustomizeTiles } from "./customize";

export const metadata = { title: "Home" };

export default async function Dashboard() {
  const ctx = await requireBusiness();
  const { business, role, user } = ctx;
  const d = await dashboard(ctx);
  const t = translator(user.uiLanguage);
  const accountant = user.uiMode === "ACCOUNTANT";

  // Team activity is for managers; the GST tile only makes sense to people who see reports.
  const available = (Object.keys(TILES) as TileId[]).filter((id) =>
    (id !== "team" || can(role, "team:manage")) && (id !== "gstMonth" || can(role, "reports:view")));
  const saved = parseTiles(ctx.membership.dashboardTiles);
  const tiles = (ctx.membership.dashboardTiles ? saved : accountant && can(role, "reports:view") ? [...saved.slice(0, 4), "gstMonth" as TileId, ...saved.slice(4)] : saved)
    .filter((id) => available.includes(id));

  const stats: Partial<Record<TileId, ReactNode>> = {
    toCollect: <Stat label={accountant ? "Sundry Debtors" : t("dash.toCollect")} value={accountant ? drCr(d.toCollect) : formatINR(d.toCollect)} tone="gave" href="/parties?type=customers" />,
    overdue: <Stat label={t("dash.overdue")} value={formatINR(d.overdueTotal)} tone="gave" href="/collections" />,
    toPay: <Stat label={accountant ? "Sundry Creditors" : t("dash.toPay")} value={accountant ? drCr(-d.toPay) : formatINR(d.toPay)} tone="got" href="/parties?type=suppliers" />,
    collectedToday: <Stat label={t("dash.collectedToday")} value={formatINR(d.todayGot)} hint={`Cash ${formatINR(d.cashToday)} · UPI ${formatINR(d.upiToday)}`} />,
    cashToday: <Stat label={t("dash.cashToday")} value={formatINR(d.cashToday)} />,
    creditToday: <Stat label={t("dash.creditToday")} value={formatINR(d.todayGave)} tone="gave" />,
    followUpsDue: <Stat label={t("dash.followUpsDue")} value={String(d.followUpsDue)} tone={d.followUpsDue > 0 ? "gave" : undefined} href="/follow-ups" />,
    openQuotes: <Stat label={t("dash.quotesOpen")} value={formatINR(d.openQuotes.totalPaise)} hint={`${d.openQuotes.count} quotation${d.openQuotes.count === 1 ? "" : "s"}`} href="/quotes" />,
    gstMonth: (
      <Stat label="Output GST this month" value={formatINR(d.gstMonth.cgst + d.gstMonth.sgst + d.gstMonth.igst)}
        hint={`${d.gstMonth.invoices} invoices · taxable ${formatINR(d.gstMonth.taxable)} · CGST ${formatINR(d.gstMonth.cgst)} · SGST ${formatINR(d.gstMonth.sgst)} · IGST ${formatINR(d.gstMonth.igst)}`} />
    ),
  };

  const lists: Partial<Record<TileId, ReactNode>> = {
    topOverdue: (
      <section>
        <h2 className="mb-2 text-xl font-bold">{t("dash.topOverdue")}</h2>
        {d.overdue.length === 0 ? (
          <EmptyState title={t("dash.nothingOverdue")}>{d.partyCount === 0 ? t("dash.firstCustomer") : t("dash.allWithin")}</EmptyState>
        ) : (
          <Card className="divide-y divide-line p-0">
            {d.overdue.map((p) => (
              <Link key={p.id} href={`/parties/${p.id}`} className="flex min-h-14 items-center justify-between gap-3 px-4 py-3 text-lg hover:bg-bg">
                <span className="truncate font-medium">{p.name}</span>
                <span className="text-right">
                  <span className="block font-semibold tabular-nums text-gave">{formatINR(p.overdue)}</span>
                  <span className="text-sm text-muted">{t("dash.ofDue", { amount: formatINR(p.balance) })}</span>
                </span>
              </Link>
            ))}
          </Card>
        )}
      </section>
    ),
    recent: (
      <section>
        <h2 className="mb-2 text-xl font-bold">{t("dash.recent")}</h2>
        {d.recent.length === 0 ? (
          <EmptyState title={t("dash.noEntries")} />
        ) : (
          <Card className="divide-y divide-line p-0">
            {d.recent.map((e) => (
              <Link key={e.id} href={`/parties/${e.partyId}`} className="flex min-h-14 items-center justify-between gap-3 px-4 py-3 text-base hover:bg-bg">
                <span>
                  <span className="block text-lg font-medium">{e.party.name}</span>
                  <span className="text-sm text-muted">{fmtDate(e.date)} · {e.note ?? t(e.direction === "GAVE" ? "col.gave" : "col.got")}</span>
                </span>
                <span className={`font-semibold tabular-nums ${e.direction === "GAVE" ? "text-gave" : "text-got"}`}>
                  {formatINR(e.amountPaise)} <span className="text-xs font-normal">{accountant ? (e.direction === "GAVE" ? "Dr" : "Cr") : t(e.direction === "GAVE" ? "col.gave" : "col.got")}</span>
                </span>
              </Link>
            ))}
          </Card>
        )}
      </section>
    ),
    team: (
      <section>
        <h2 className="mb-2 text-xl font-bold">{t("dash.team")}</h2>
        {d.activity.length === 0 ? (
          <EmptyState title={t("dash.noEntries")} />
        ) : (
          <Card className="divide-y divide-line p-0">
            {d.activity.map((a) => (
              <div key={a.userId} className="flex items-center justify-between px-4 py-3 text-sm">
                <span>
                  <span className="block font-medium">{a.name}</span>
                  <span className="text-xs text-muted">{a.role.toLowerCase()} · {a.entries} entries</span>
                </span>
                <span className="text-right">
                  <span className="block font-semibold tabular-nums text-got">Collected {formatINR(a.collected)}</span>
                  <span className="text-xs tabular-nums text-gave">Gave {formatINR(a.gave)}</span>
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

  return (
    <>
      <PageHeader
        title={t("dash.today")}
        sub={new Date().toLocaleDateString(user.uiLanguage === "en" ? "en-IN" : `${user.uiLanguage}-IN`, { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Kolkata" })}
      />
      <nav aria-label="Quick actions" className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {can(role, "ledger:write") && <Quick href="/parties" icon="plus" label={t("dash.writeEntry")} tone="primary" />}
        {can(role, "invoice:write") && <Quick href="/invoices/new" icon="bill" label={t("dash.newInvoice")} />}
        {can(role, "reminder:send") && <Quick href="/collections" icon="send" label={t("dash.askMoney")} />}
        {can(role, "party:write") && <Quick href="/parties/new" icon="users" label={t("dash.addParty")} />}
      </nav>
      <div className="mb-3 flex justify-end">
        <CustomizeTiles current={tiles} available={available} label={t("dash.customize")} />
      </div>

      {statTiles.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {statTiles.map((id) => <div key={id} className={id === "gstMonth" ? "sm:col-span-2" : ""}>{stats[id]}</div>)}
        </div>
      )}

      {!business.upiId && (
        <Card className="mt-4 border-brand/40 bg-brand/5 text-base">
          Add your UPI ID in <Link href="/settings" className="font-semibold text-brand underline">Settings</Link> so customers can pay you straight from your reminders and bills.
        </Card>
      )}

      {listTiles.length > 0 && (
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          {listTiles.map((id) => <div key={id}>{lists[id]}</div>)}
        </div>
      )}
    </>
  );
}

function Quick({ href, icon, label, tone }: { href: string; icon: IconName; label: string; tone?: "primary" }) {
  return (
    <Link
      href={href}
      className={`flex min-h-24 flex-col items-start justify-between gap-3 rounded-2xl border p-4 text-lg font-bold leading-tight transition active:scale-[0.98] ${tone === "primary" ? "border-brand bg-brand text-brand-ink" : "border-line bg-card hover:bg-bg"}`}
    >
      <Icon name={icon} size={28} className={tone === "primary" ? "" : "text-brand"} />
      {label}
    </Link>
  );
}

function Stat({ label, value, hint, tone, href }: { label: string; value: string; hint?: string; tone?: "gave" | "got"; href?: string }) {
  const body = (
    <Card className={`h-full ${href ? "hover:bg-bg" : ""}`}>
      <p className="text-base text-muted">{label}</p>
      <p className={`mt-1 text-3xl font-bold tabular-nums ${tone === "gave" ? "text-gave" : tone === "got" ? "text-got" : ""}`}>{value}</p>
      {hint && <p className="mt-1 text-sm text-muted">{hint}</p>}
    </Card>
  );
  return href ? <Link href={href} className="block h-full">{body}</Link> : body;
}
