import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { InvoiceDocument } from "@/components/invoice-document";

// Public invoice view with "Pay now" (no login). Access is by unguessable token.
export const metadata = { title: "Invoice", robots: { index: false } };

export default async function PublicInvoice({ params }: PageProps<"/i/[token]">) {
  const { token } = await params;
  const invoice = await db.invoice.findUnique({ where: { shareToken: token }, include: { lines: true, party: true, business: true } });
  if (!invoice || invoice.status === "CANCELLED") notFound();
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <InvoiceDocument invoice={invoice} business={invoice.business} party={invoice.party} />
    </main>
  );
}
