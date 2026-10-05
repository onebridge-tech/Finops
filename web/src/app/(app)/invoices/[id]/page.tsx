import { notFound } from "next/navigation";
import Link from "next/link";
import { requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import { appUrl, whatsappLink } from "@/lib/share";
import { formatINR } from "@/lib/money";
import { InvoiceDocument } from "@/components/invoice-document";
import { PageHeader, buttonClass } from "@/components/ui";
import { CopyLink } from "../../parties/[id]/reminder";
import { PrintButton } from "@/components/print-button";

export default async function InvoicePage({ params }: PageProps<"/invoices/[id]">) {
  const { id } = await params;
  const { business } = await requireBusiness();
  const invoice = await db.invoice.findFirst({ where: { id, businessId: business.id }, include: { lines: true, party: true } });
  if (!invoice) notFound();

  const url = appUrl(`/i/${invoice.shareToken}`);
  const wa = invoice.party.phone
    ? whatsappLink(invoice.party.phone, `Invoice ${invoice.number} from ${business.name} for ${formatINR(invoice.totalPaise)}. View and pay: ${url}`)
    : null;

  return (
    <>
      <div className="no-print">
        <PageHeader
          title={invoice.number}
          sub={<Link href={`/parties/${invoice.partyId}`} className="hover:underline">{invoice.party.name}</Link>}
          action={
            <div className="flex flex-wrap gap-2">
              <CopyLink url={url} />
              <PrintButton />
              {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className={buttonClass("primary")}>Share on WhatsApp</a>}
            </div>
          }
        />
      </div>
      <InvoiceDocument invoice={invoice} business={business} party={invoice.party} />
    </>
  );
}
