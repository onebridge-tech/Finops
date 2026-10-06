import Link from "next/link";
import { notFound } from "next/navigation";
import { can, requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatINR } from "@/lib/money";
import { archivePriceList, deletePriceRow } from "@/app/actions/catalog";
import { Card, PageHeader } from "@/components/ui";
import { FillForm, RateForm } from "../forms";

export const metadata = { title: "Price list" };

export default async function PriceListPage({ params }: PageProps<"/price-lists/[id]">) {
  const { id } = await params;
  const ctx = await requireBusiness();
  const list = await db.priceList.findFirst({ where: { id, businessId: ctx.business.id, archivedAt: null }, include: { items: true } });
  if (!list) notFound();
  const [items, parties] = await Promise.all([
    db.item.findMany({ where: { businessId: ctx.business.id, archivedAt: null }, orderBy: [{ name: "asc" }, { variantName: "asc" }] }),
    db.party.findMany({ where: { businessId: ctx.business.id, archivedAt: null, priceListId: id }, select: { id: true, name: true } }),
  ]);
  const name = new Map(items.map((i) => [i.id, i.variantName ? `${i.name} — ${i.variantName}` : i.name]));
  const standard = new Map(items.map((i) => [i.id, Number(i.pricePaise)]));
  const rows = [...list.items].sort((a, b) => (name.get(a.itemId) ?? "").localeCompare(name.get(b.itemId) ?? "") || a.minQtyMilli - b.minQtyMilli);
  const write = can(ctx.role, "item:write");

  return (
    <>
      <PageHeader title={list.name} sub={<><Link href="/price-lists" className="hover:underline">All lists</Link> · used by {parties.length === 0 ? "no parties yet" : parties.map((p) => p.name).join(", ")}</>} />
      {write && (
        <div className="mb-6 grid gap-4 lg:grid-cols-2">
          <Card className="space-y-3"><h2 className="font-semibold">Add or change a rate</h2><RateForm listId={list.id} items={items.map((i) => ({ id: i.id, name: name.get(i.id)!, price: formatINR(i.pricePaise) }))} /></Card>
          <Card className="space-y-3"><h2 className="font-semibold">Fill the whole list</h2><FillForm listId={list.id} /></Card>
        </div>
      )}
      {rows.length === 0 ? <Card className="text-sm text-muted">No rates yet. Items not on this list use their standard price.</Card> : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[480px] text-sm">
            <thead className="border-b border-line text-left text-xs uppercase text-muted"><tr><th className="px-4 py-2">Item</th><th className="px-4 py-2 text-right">From qty</th><th className="px-4 py-2 text-right">Rate</th><th className="px-4 py-2 text-right">Standard</th><th className="px-4 py-2"></th></tr></thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-2 font-medium">{name.get(r.itemId) ?? "—"}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{r.minQtyMilli === 0 ? "any" : r.minQtyMilli / 1000 + "+"}</td>
                  <td className="px-4 py-2 text-right font-semibold tabular-nums">{formatINR(r.ratePaise)}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-muted">{formatINR(standard.get(r.itemId) ?? 0)}</td>
                  <td className="px-4 py-2 text-right">{write && <form action={deletePriceRow}><input type="hidden" name="rowId" value={r.id} /><button className="text-xs text-muted underline hover:text-gave">Remove</button></form>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      {write && (
        <form action={archivePriceList} className="mt-4">
          <input type="hidden" name="listId" value={list.id} />
          <button className="text-sm text-muted underline hover:text-gave">Archive this list (parties on it go back to standard prices)</button>
        </form>
      )}
    </>
  );
}
