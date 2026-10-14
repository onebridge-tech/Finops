import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { can, requireBusiness } from "@/lib/auth";
import { partiesWithBalance } from "@/lib/queries";
import { translator, type UiKey } from "@/lib/i18n";
import { ledgerGroup } from "@/lib/accounting";
import { Balance, Card, EmptyState, Input, LinkButton, PageHeader } from "@/components/ui";

export const metadata = { title: "Parties" };

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
        action={write && <div className="flex gap-2"><LinkButton href="/data?tab=parties" variant="secondary">{t("parties.import")}</LinkButton><LinkButton href="/parties/new">{t("dash.addParty")}</LinkButton></div>}
      />
      <form className="mb-3">
        <Input name="q" defaultValue={q} placeholder={t("parties.search")} />
        {tab !== "all" && <input type="hidden" name="type" value={tab} />}
      </form>
      <nav className="mb-4 flex flex-wrap gap-2">
        {TABS.map(([x, key]) => (
          <Link key={x} href={href(x)} className={`min-h-11 rounded-full px-4 py-2 text-base font-medium ${tab === x ? "bg-brand text-brand-ink" : "border border-line bg-card text-muted hover:text-ink"}`}>{t(key)}</Link>
        ))}
      </nav>
      {parties.length === 0 ? (
        <EmptyState title={q ? t("parties.noMatch") : t("parties.none")}>
          {!q && tab === "all" && t("dash.firstCustomer")}
        </EmptyState>
      ) : (
        <Card className="divide-y divide-line p-0">
          {parties.map((p) => (
            <Link key={p.id} href={`/parties/${p.id}`} className="flex min-h-16 items-center justify-between gap-3 px-4 py-3 hover:bg-bg">
              <span className="min-w-0">
                <span className="block truncate text-lg font-semibold">{p.name}</span>
                <span className="text-sm text-muted">
                  {accountant ? ledgerGroup(p.type, p.balance) : t(`type.${p.type}` as UiKey)}
                  {p.phone ? ` · +${p.phone}` : ""}{accountant && p.gstin ? ` · ${p.gstin}` : ""}
                </span>
              </span>
              {p.type !== "LEAD" && <Balance paise={p.balance} className="shrink-0 text-right" t={t} accountant={accountant} />}
            </Link>
          ))}
        </Card>
      )}
    </>
  );
}
