import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { fileUrl } from "@/lib/files";
import { PrintButton } from "@/components/print-button";
import { InviteCta } from "@/components/invite-cta";
import { CatalogueCart } from "./cart";

// Public catalogue: share the link or print it as a PDF. Buyers pick items and send an order request, no login.
export const metadata = { title: "Item list to share", robots: { index: false } };

export default async function Catalogue({ params }: PageProps<"/c/[token]">) {
  const { token } = await params;
  const b = await db.business.findFirst({ where: { catalogToken: token, catalogEnabled: true } });
  if (!b) notFound();
  const all = await db.item.findMany({ where: { businessId: b.id, isPublic: true, archivedAt: null }, orderBy: [{ category: "asc" }, { name: "asc" }, { variantName: "asc" }] });
  const logo = fileUrl(b.logoFileId);
  const products = all.map((i) => ({
    id: i.id, name: i.variantName ? `${i.name} — ${i.variantName}` : i.name, description: i.description ?? "", unit: i.unit,
    price: Number(i.pricePaise), gst: i.taxRateBp / 100, category: i.category ?? "Other", image: fileUrl(i.imageFileId),
  }));

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <header className="mb-6 flex items-center gap-4 border-b-4 pb-4" style={{ borderColor: b.brandColor }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {logo && <img src={logo} alt="" className="h-14 w-auto rounded bg-white object-contain p-1" />}
        <div className="flex-1">
          <p className="text-sm uppercase tracking-wide text-muted">Item list to share</p>
          <h1 className="text-2xl font-bold">{b.name}</h1>
          <p className="text-base text-muted">{[b.address, b.phone].filter(Boolean).join(" · ")}</p>
        </div>
        <span className="no-print"><PrintButton /></span>
      </header>
      {products.length === 0 ? <p className="text-muted">Nothing is listed right now.</p> : <CatalogueCart token={token} products={products} business={b.name} />}
      <InviteCta businessId={b.id} businessName={b.name} />
    </main>
  );
}
