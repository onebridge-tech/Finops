import Link from "next/link";
import { branchOrShared, partyWhere, requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatINR } from "@/lib/money";
import { Card, EmptyState, LinkButton, PageHeader, fmtDate } from "@/components/ui";

export const metadata = { title: "Orders" };

const TABS = [["open", "Open"], ["requests", "Requests"], ["purchase", "Purchase"], ["done", "Delivered / closed"]] as const;
const TONE: Record<string, string> = { REQUEST: "text-brand", OPEN: "text-muted", PARTIAL: "text-gave", FULFILLED: "text-got", CANCELLED: "text-muted" };

export default async function Orders({ searchParams }: PageProps<"/orders">) {
  const sp = await searchParams;
  const tab = TABS.find(([t]) => t === sp.tab)?.[0] ?? "open";
  const ctx = await requireBusiness();
  const parties = await db.party.findMany({ where: partyWhere(ctx), select: { id: true, name: true } });
  const pn = new Map(parties.map((p) => [p.id, p.name]));
  const status =
    tab === "open" ? { kind: "SALES", status: { in: ["OPEN", "PARTIAL"] } }
    : tab === "requests" ? { kind: "SALES", status: "REQUEST" }
    : tab === "purchase" ? { kind: "PURCHASE", status: { in: ["OPEN", "PARTIAL"] } }
    : { status: { in: ["FULFILLED", "CANCELLED"] } };
  const [orders, requests] = await Promise.all([
    db.order.findMany({
      where: { businessId: ctx.business.id, ...branchOrShared(ctx), partyId: { in: [...pn.keys()] }, ...status },
      orderBy: { createdAt: "desc" }, take: 100,
    }),
    db.order.count({ where: { businessId: ctx.business.id, kind: "SALES", status: "REQUEST" } }),
  ]);
  return (
    <>
      <PageHeader
        title="Orders"
        sub="What customers ordered from you, and what you ordered from suppliers."
        action={<div className="flex gap-2"><LinkButton href="/orders/new?kind=PURCHASE" variant="secondary">Order to supplier</LinkButton><LinkButton href="/orders/new">Customer order</LinkButton></div>}
      />
      <nav className="mb-4 flex flex-wrap gap-1 text-base">
        {TABS.map(([t, l]) => (
          <Link key={t} href={`/orders?tab=${t}`} className={`rounded-lg px-3 py-1.5 ${tab === t ? "bg-brand text-brand-ink" : "text-muted hover:bg-card"}`}>
            {l}{t === "requests" && requests > 0 && <span className="ml-1 rounded-full bg-gave px-1.5 text-[10px] font-semibold text-white">{requests}</span>}
          </Link>
        ))}
        <Link href="/reports/orders" className="ml-auto px-3 py-1.5 text-muted underline">Pending-items report</Link>
      </nav>
      {orders.length === 0 ? <EmptyState title="No orders here" /> : (
        <Card className="divide-y divide-line p-0 text-base">
          {orders.map((o) => (
            <Link key={o.id} href={`/orders/${o.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-bg">
              <span>
                <span className="block font-medium">{o.number} · {pn.get(o.partyId) ?? "—"}</span>
                <span className="text-sm text-muted">
                  {fmtDate(o.date)}{o.expectedDate && ` · expected ${fmtDate(o.expectedDate)}`}
                  {o.source === "CATALOGUE" && " · from catalogue"}{o.source === "VISIT" && " · taken on a visit"} · <span className={TONE[o.status]}>{o.status.toLowerCase()}</span>
                </span>
              </span>
              <span className="font-semibold tabular-nums">{formatINR(o.totalPaise)}</span>
            </Link>
          ))}
        </Card>
      )}
    </>
  );
}
