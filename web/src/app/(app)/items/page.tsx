import { can, requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatINR } from "@/lib/money";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { ItemForm } from "./item-form";

export const metadata = { title: "Items" };

export default async function Items() {
  const { business, role } = await requireBusiness();
  const items = await db.item.findMany({ where: { businessId: business.id, archivedAt: null }, orderBy: { name: "asc" } });
  return (
    <>
      <PageHeader title="Items" sub="Products and services you sell. Used on quotations and invoices." />
      {can(role, "item:write") && <Card className="mb-4"><ItemForm /></Card>}
      {items.length === 0 ? (
        <EmptyState title="No items yet" />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[520px] text-sm">
            <thead className="border-b border-line text-left text-xs uppercase text-muted">
              <tr><th className="px-4 py-2">Name</th><th className="px-4 py-2">HSN/SAC</th><th className="px-4 py-2">Unit</th><th className="px-4 py-2 text-right">Price</th><th className="px-4 py-2 text-right">GST</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {items.map((i) => (
                <tr key={i.id}>
                  <td className="px-4 py-2 font-medium">{i.name}{i.sku && <span className="ml-2 text-xs text-muted">{i.sku}</span>}</td>
                  <td className="px-4 py-2">{i.hsn ?? "—"}</td>
                  <td className="px-4 py-2">{i.unit}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{formatINR(i.pricePaise)}</td>
                  <td className="px-4 py-2 text-right">{i.taxRateBp / 100}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}
