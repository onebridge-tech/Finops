import Link from "next/link";
import { can, requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatINR } from "@/lib/money";
import { fileUrl } from "@/lib/files";
import { archiveItem } from "@/app/actions/billing";
import { AddPanel, Card, EmptyState, PageHeader } from "@/components/ui";
import { ItemForm } from "./item-form";

export const metadata = { title: "Items" };

export default async function Items({ searchParams }: PageProps<"/items">) {
  const archived = (await searchParams).archived === "1";
  const { business, role } = await requireBusiness();
  const write = can(role, "item:write");
  const [items, bases] = await Promise.all([
    db.item.findMany({ where: { businessId: business.id, archivedAt: archived ? { not: null } : null }, orderBy: [{ name: "asc" }, { variantName: "asc" }] }),
    db.item.findMany({ where: { businessId: business.id, archivedAt: null, parentId: null }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  // Variants sit directly under their base product.
  const ordered = items.filter((i) => !i.parentId || !items.some((p) => p.id === i.parentId))
    .flatMap((base) => [base, ...items.filter((v) => v.parentId === base.id)]);

  return (
    <>
      <PageHeader
        title="Items"
        sub="What you sell. Used on your bills and price quotes."
        action={<Link href={archived ? "/items" : "/items?archived=1"} className="text-sm text-muted underline">{archived ? "Back to active items" : "Archived items"}</Link>}
      />
      {write && !archived && <AddPanel title="Add an item"><ItemForm bases={bases} /></AddPanel>}
      {ordered.length === 0 ? (
        <EmptyState title={archived ? "No archived items" : "No items yet"} />
      ) : (
        <Card className="overflow-x-auto p-0 sm:p-0">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b border-line bg-bg/50 text-left text-xs font-medium text-muted">
              <tr>
                <th className="px-4 py-2">Item</th><th className="px-4 py-2">HSN/SAC</th><th className="px-4 py-2">Unit</th>
                <th className="px-4 py-2 text-right">Sale price</th><th className="px-4 py-2 text-right">Margin</th><th className="px-4 py-2 text-right">GST</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {ordered.map((i) => {
                const img = fileUrl(i.imageFileId);
                const margin = i.purchasePricePaise !== null && i.pricePaise > 0n ? Number(i.pricePaise - i.purchasePricePaise) / Number(i.pricePaise) : null;
                return (
                  <tr key={i.id}>
                    <td className={`px-4 py-2 ${i.parentId ? "pl-10" : ""}`}>
                      <span className="flex items-center gap-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {img ? <img src={img} alt="" className="size-9 rounded border border-line object-cover" /> : <span className="size-9 rounded border border-dashed border-line" />}
                        <span>
                          <span className="font-medium">{i.parentId ? i.variantName : i.name}</span>
                          <span className="block text-xs text-muted">{[i.sku, i.isPublic && "in catalogue"].filter(Boolean).join(" · ")}</span>
                        </span>
                      </span>
                    </td>
                    <td className="px-4 py-2">{i.hsn ?? "—"}</td>
                    <td className="px-4 py-2">{i.unit}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{formatINR(i.pricePaise)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{margin === null ? "—" : `${Math.round(margin * 1000) / 10}%`}</td>
                    <td className="px-4 py-2 text-right">{i.taxRateBp / 100}%</td>
                    <td className="whitespace-nowrap px-4 py-2 text-right">
                      {write && (
                        <span className="flex justify-end gap-3 text-xs">
                          {!archived && <Link href={`/items/${i.id}`} className="text-muted underline hover:text-ink">Edit</Link>}
                          <form action={archiveItem}>
                            <input type="hidden" name="itemId" value={i.id} />
                            <input type="hidden" name="archive" value={archived ? "0" : "1"} />
                            <button className="text-muted underline hover:text-ink">{archived ? "Restore" : "Archive"}</button>
                          </form>
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}
