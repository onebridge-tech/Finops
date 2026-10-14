import Link from "next/link";
import { can, requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import { AddPanel, Card, EmptyState, PageHeader } from "@/components/ui";
import { NewListForm } from "./forms";

export const metadata = { title: "Special prices" };

export default async function PriceLists() {
  const ctx = await requireBusiness();
  const [lists, parties] = await Promise.all([
    db.priceList.findMany({ where: { businessId: ctx.business.id, archivedAt: null }, include: { _count: { select: { items: true } } }, orderBy: { name: "asc" } }),
    db.party.groupBy({ by: ["priceListId"], where: { businessId: ctx.business.id, archivedAt: null, priceListId: { not: null } }, _count: true }),
  ]);
  const used = new Map(parties.map((p) => [p.priceListId, p._count]));
  return (
    <>
      <PageHeader title="Special prices" sub="A different rate for dealers or regular customers, even by quantity. The right rate fills in by itself on price quotes, orders and bills." />
      {can(ctx.role, "item:write") && <AddPanel title="New special price list"><NewListForm /></AddPanel>}
      {lists.length === 0 ? <EmptyState title="No price lists yet">Create one, add rates, then pick it on a party’s page (Edit).</EmptyState> : (
        <Card className="divide-y divide-line p-0 text-sm">
          {lists.map((l) => (
            <Link key={l.id} href={`/price-lists/${l.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-bg">
              <span className="font-medium">{l.name}</span>
              <span className="text-xs text-muted">{l._count.items} rates · {used.get(l.id) ?? 0} parties</span>
            </Link>
          ))}
        </Card>
      )}
    </>
  );
}
