import Link from "next/link";
import { can, requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import { stockLevels } from "@/lib/reports2";
import { formatINR } from "@/lib/money";
import { Badge, Card, EmptyState, PageHeader, fmtDate } from "@/components/ui";
import { Icon } from "@/components/icon";
import { AdjustStockForm } from "./adjust-form";

export const metadata = { title: "Stock" };

const REASON: Record<string, string> = { INVOICE: "Sold", PURCHASE: "Received", RETURN: "Returned", ADJUSTMENT: "Adjusted", OPENING: "Opening stock", CANCEL: "Invoice cancelled" };

export default async function Stock({ searchParams }: PageProps<"/stock">) {
  const sp = await searchParams;
  const ctx = await requireBusiness();
  const lowOnly = sp.low === "1";
  const levels = await stockLevels(ctx);
  const rows = levels.filter((r) => !lowOnly || r.low);
  const selected = typeof sp.item === "string" ? levels.find((r) => r.item.id === sp.item) : undefined;
  const history = selected
    ? await db.stockMovement.findMany({ where: { businessId: ctx.business.id, itemId: selected.item.id, ...(ctx.branchId ? { branchId: ctx.branchId } : {}) }, orderBy: { createdAt: "desc" }, take: 50 })
    : [];
  const value = levels.reduce((s, r) => s + Math.max(0, Math.round((Number(r.item.purchasePricePaise ?? r.item.pricePaise) * r.level) / 1000)), 0);
  const lowCount = levels.filter((r) => r.low).length;
  const canAdjust = can(ctx.role, "stock:write");
  const label = (i: (typeof levels)[number]["item"]) => (i.variantName ? `${i.name} — ${i.variantName}` : i.name);

  return (
    <>
      <PageHeader title="Stock" sub={`${levels.length} items tracked · stock value ${formatINR(value)}${lowCount ? ` · ${lowCount} low` : ""}`}
        action={<div className="flex gap-3 text-sm"><Link href={lowOnly ? "/stock" : "/stock?low=1"} className="text-brand underline">{lowOnly ? "Show all" : "Low stock only"}</Link><Link href="/reports/stock" className="text-brand underline">Report</Link></div>} />
      {levels.length === 0 ? (
        <EmptyState icon="box" title="No items track stock yet">Open an item, tick “Track stock” and set a low-stock level. Your bills then reduce the stock, and supplier orders add to it.</EmptyState>
      ) : (
        <Card className="divide-y divide-line p-0 sm:p-0">
          {rows.length === 0 && <p className="px-4 py-6 text-center text-muted">Nothing is running low.</p>}
          {rows.map(({ item, level, low }) => (
            <Link key={item.id} href={`/stock?item=${item.id}${lowOnly ? "&low=1" : ""}`} className={`flex items-center gap-3 px-4 py-3 transition hover:bg-bg ${selected?.item.id === item.id ? "bg-brand-soft" : ""}`}>
              <span className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${low ? "bg-gave/10 text-gave" : "bg-brand-soft text-brand"}`}><Icon name="box" size={18} /></span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{label(item)}</span>
                <span className="text-xs text-muted">{item.reorderLevelMilli === null ? "No low-stock level set" : `Tell me at ${item.reorderLevelMilli / 1000} ${item.unit}`}</span>
              </span>
              <span className="flex flex-col items-end gap-1">
                <span className={`font-semibold tabular-nums ${low ? "text-gave" : ""}`}>{level / 1000} {item.unit}</span>
                {low && <Badge tone="bad">Low</Badge>}
              </span>
            </Link>
          ))}
        </Card>
      )}

      {canAdjust && levels.length > 0 && (
        <Card className="mt-6 space-y-3">
          <h2 className="text-base font-semibold tracking-tight">Adjust stock</h2>
          <AdjustStockForm items={levels.map((r) => ({ id: r.item.id, name: label(r.item) }))} selected={selected?.item.id ?? ""} />
        </Card>
      )}

      {selected && (
        <>
          <h2 className="mb-2 mt-6 text-base font-semibold tracking-tight">History · {label(selected.item)}</h2>
          <Card className="divide-y divide-line p-0 text-sm">
            {history.length === 0 && <p className="px-4 py-3 text-muted">No movements.</p>}
            {history.map((m) => (
              <div key={m.id} className="flex justify-between gap-3 px-4 py-2">
                <span>{REASON[m.reason] ?? m.reason}{m.note && ` · ${m.note}`}<span className="block text-xs text-muted">{fmtDate(m.createdAt)}</span></span>
                <span className={`tabular-nums ${m.qtyMilli > 0 ? "text-got" : "text-gave"}`}>{m.qtyMilli > 0 ? "+" : ""}{m.qtyMilli / 1000}</span>
              </div>
            ))}
          </Card>
        </>
      )}
    </>
  );
}
