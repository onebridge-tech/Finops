import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { trackView } from "@/lib/views";
import { DocumentView } from "@/components/document-view";
import { PrintButton } from "@/components/print-button";
import { InviteCta } from "@/components/invite-cta";

// Public invoice view with "Pay now" (no login). Access is by unguessable token.
export const metadata = { title: "Invoice", robots: { index: false } };

export default async function PublicInvoice({ params }: PageProps<"/i/[token]">) {
  const { token } = await params;
  const invoice = await db.invoice.findUnique({ where: { shareToken: token }, include: { lines: true, party: true, business: true } });
  if (!invoice) notFound();
  await trackView("invoice", invoice.id, invoice.businessId);
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <DocumentView doc={{ ...invoice, kind: "INVOICE" }} business={invoice.business} party={invoice.party} />
      <div className="no-print mt-4 flex items-center justify-center gap-4 text-sm">
        <PrintButton />
        <a href={`/s/${invoice.party.shareToken}`} className="text-muted underline">View your full statement</a>
      </div>
      <InviteCta businessId={invoice.businessId} businessName={invoice.business.name} />
    </main>
  );
}
