import { notFound } from "next/navigation";
import { requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import { toRupeeString } from "@/lib/money";
import { fileUrl } from "@/lib/files";
import { Card, PageHeader } from "@/components/ui";
import { ItemForm } from "../item-form";

export const metadata = { title: "Edit item" };

export default async function EditItem({ params }: PageProps<"/items/[id]">) {
  const { id } = await params;
  const { business } = await requireBusiness("item:write");
  const [item, bases] = await Promise.all([
    db.item.findFirst({ where: { id, businessId: business.id } }),
    db.item.findMany({ where: { businessId: business.id, archivedAt: null, parentId: null }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  if (!item) notFound();
  return (
    <>
      <PageHeader title={item.variantName ? `${item.name} — ${item.variantName}` : item.name} />
      <Card>
        <ItemForm
          bases={bases}
          item={{
            id: item.id, name: item.name, description: item.description ?? "", sku: item.sku ?? "", unit: item.unit,
            price: toRupeeString(Number(item.pricePaise)),
            purchasePrice: item.purchasePricePaise === null ? "" : toRupeeString(Number(item.purchasePricePaise)),
            hsn: item.hsn ?? "", taxRateBp: item.taxRateBp, isPublic: item.isPublic, parentId: item.parentId ?? "",
            variantName: item.variantName ?? "", imageUrl: fileUrl(item.imageFileId),
            category: item.category ?? "", trackStock: item.trackStock, reorderLevel: item.reorderLevelMilli === null ? "" : String(item.reorderLevelMilli / 1000),
          }}
        />
      </Card>
    </>
  );
}
