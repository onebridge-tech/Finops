import Link from "next/link";
import { can, requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatINR } from "@/lib/money";
import { fileUrl } from "@/lib/files";
import { archiveItem } from "@/app/actions/billing";
import { AddPanel, Card, EmptyState, PageHeader } from "@/components/ui";
import { Icon } from "@/components/icon";
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
        <EmptyState icon="box" title={archived ? "No archived items" : "No items yet"}>{!archived && "Add what you sell once. Then pick it when you make a bill."}</EmptyState>
      ) : (
        <Card className="divide-y divide-line p-0 sm:p-0">
          {ordered.map((i) => {
            const img = fileUrl(i.imageFileId);
            const margin = i.purchasePricePaise !== null && i.pricePaise > 0n ? Number(i.pricePaise - i.purchasePricePaise) / Number(i.pricePaise) : null;
            return (
              <div key={i.id} className={`flex items-center gap-3 px-4 py-3 ${i.parentId ? "pl-10" : ""}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {img ? <img src={img} alt="" className="size-10 shrink-0 rounded-lg border border-line object-cover" /> : <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand"><Icon name="box" size={18} /></span>}
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{i.parentId ? i.variantName : i.name}</span>
                  <span className="block truncate text-xs text-muted">
                    {[i.hsn && `HSN ${i.hsn}`, i.unit, `GST ${i.taxRateBp / 100}%`, margin !== null && `margin ${Math.round(margin * 1000) / 10}%`, i.sku, i.isPublic && "in your shared list"].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <span className="text-right">
                  <span className="block font-semibold tabular-nums">{formatINR(i.pricePaise)}</span>
                  {write && (
                    <span className="flex justify-end gap-3 text-xs">
                      {!archived && <Link href={`/items/${i.id}`} className="text-brand hover:underline">Edit</Link>}
                      <form action={archiveItem}>
                        <input type="hidden" name="itemId" value={i.id} />
                        <input type="hidden" name="archive" value={archived ? "0" : "1"} />
                        <button className="text-muted hover:text-ink hover:underline">{archived ? "Restore" : "Archive"}</button>
                      </form>
                    </span>
                  )}
                </span>
              </div>
            );
          })}
        </Card>
      )}
    </>
  );
}
