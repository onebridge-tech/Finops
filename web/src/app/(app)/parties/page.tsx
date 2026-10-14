import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { can, requireBusiness } from "@/lib/auth";
import { partiesWithBalance } from "@/lib/queries";
import { translator, type UiKey } from "@/lib/i18n";
import { ledgerGroup } from "@/lib/accounting";
import { Avatar, Balance, Badge, Card, EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { Icon } from "@/components/icon";

export const metadata = { title: "Customers & suppliers" };

const TABS: ["all" | "customers" | "suppliers" | "leads" | "archived", UiKey][] = [
  ["all", "parties.all"], ["customers", "parties.customers"], ["suppliers", "parties.suppliers"], ["leads", "parties.leads"], ["archived", "parties.archived"],
];

const TAB_WHERE: Record<(typeof TABS)[number][0], Prisma.PartyWhereInput> = {
  all: { type: { not: "LEAD" } },
  customers: { type: { in: ["CUSTOMER", "BOTH"] } },
  suppliers: { type: { in: ["SUPPLIER", "BOTH"] } },
  leads: { type: "LEAD" },
  archived: { archivedAt: { not: null } },
};

export default async function Parties({ searchParams }: PageProps<"/parties">) {
  const ctx = await requireBusiness();
  const t = translator(ctx.user.uiLanguage);
  const accountant = ctx.user.uiMode === "ACCOUNTANT";
  const sp = await searchParams;
  const q = String(sp.q ?? "").trim();
  const tab = TABS.find(([x]) => x === sp.type)?.[0] ?? "all";
  const parties = await partiesWithBalance(ctx, { q, where: TAB_WHERE[tab], includeArchived: tab === "archived" });
  const href = (x: string) => `/parties?${new URLSearchParams({ ...(q ? { q } : {}), ...(x === "all" ? {} : { type: x }) })}`;
  const write = can(ctx.role, "party:write");

  return (
    <>
      <PageHeader
        title={t("parties.title")}
        sub={t("parties.total", { n: parties.length })}
        action={write && (
          <div className="flex gap-2">
            <LinkButton href="/data?tab=parties" variant="secondary">{t("parties.import")}</LinkButton>
            <LinkButton href="/parties/new"><Icon name="plus" size={16} />{t("dash.addParty")}</LinkButton>
          </div>
        )}
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <nav className="flex max-w-full gap-1 overflow-x-auto rounded-lg bg-line/50 p-1" aria-label="Filter">
          {TABS.map(([x, key]) => (
            <Link key={x} href={href(x)} className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition ${tab === x ? "bg-card text-ink shadow-sm" : "text-muted hover:text-ink"}`}>{t(key)}</Link>
          ))}
        </nav>
        <form className="relative w-full sm:w-72">
          <Icon name="search" size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input name="q" defaultValue={q} placeholder={t("parties.search")} aria-label={t("parties.search")} className="h-10 w-full rounded-lg border border-line bg-card pl-9 pr-3 text-sm shadow-sm outline-none placeholder:text-muted/70 focus:border-brand focus:ring-2 focus:ring-brand/20" />
          {tab !== "all" && <input type="hidden" name="type" value={tab} />}
        </form>
      </div>

      {parties.length === 0 ? (
        <EmptyState
          icon="users"
          title={q ? t("parties.noMatch") : t("parties.none")}
          action={!q && tab === "all" && write ? <LinkButton href="/parties/new"><Icon name="plus" size={16} />{t("dash.addParty")}</LinkButton> : undefined}
        >
          {!q && tab === "all" && t("dash.firstCustomer")}
        </EmptyState>
      ) : (
        <Card className="divide-y divide-line p-0 sm:p-0">
          {parties.map((p) => (
            <Link key={p.id} href={`/parties/${p.id}`} className="flex items-center gap-3 px-4 py-3 transition hover:bg-bg">
              <Avatar name={p.name} size={38} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{p.name}</span>
                <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted">
                  {p.type === "SUPPLIER" ? <Badge tone="warn">{t("type.SUPPLIER")}</Badge> : p.type === "LEAD" ? <Badge tone="brand">{t("type.LEAD")}</Badge> : null}
                  <span>{accountant ? ledgerGroup(p.type, p.balance) : p.type === "CUSTOMER" ? t("type.CUSTOMER") : p.type === "BOTH" ? t("type.BOTH") : ""}</span>
                  {p.phone && <span>+{p.phone}</span>}
                  {accountant && p.gstin && <span>{p.gstin}</span>}
                </span>
              </span>
              {p.type !== "LEAD" && <Balance paise={p.balance} className="shrink-0 text-right" t={t} accountant={accountant} stacked />}
            </Link>
          ))}
        </Card>
      )}
    </>
  );
}
