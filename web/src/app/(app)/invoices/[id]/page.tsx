import { notFound } from "next/navigation";
import Link from "next/link";
import { can, docWhere, requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import { appUrl, whatsappLink } from "@/lib/share";
import { formatINR } from "@/lib/money";
import { renderMessage } from "@/lib/messaging/templates";
import { blockedReason } from "@/lib/messaging/send";
import { DocumentView } from "@/components/document-view";
import { CancelInvoiceForm, SendDocumentForm } from "@/components/document-actions";
import { PrintButton } from "@/components/print-button";
import { Card, PageHeader, buttonClass, fmtDate } from "@/components/ui";
import { CopyLink } from "../../parties/[id]/reminder";
import { invoicePayments } from "@/lib/queries";

export const metadata = { title: "Bill" };

export default async function InvoicePage({ params }: PageProps<"/invoices/[id]">) {
  const { id } = await params;
  const ctx = await requireBusiness();
  const { business, role } = ctx;
  const invoice = await db.invoice.findFirst({ where: { ...docWhere(ctx), id }, include: { lines: true, party: true } });
  if (!invoice) notFound();
  const quote = invoice.quoteId ? await db.quote.findUnique({ where: { id: invoice.quoteId }, select: { id: true, number: true } }) : null;

  const pay = (await invoicePayments(business.id, [invoice])).get(invoice.id);
  const cancelled = invoice.status === "CANCELLED";
  const url = appUrl(`/i/${invoice.shareToken}`);
  const text = renderMessage("INVOICE", invoice.party.language, { party: invoice.party.name, business: business.name, number: invoice.number, amountPaise: Number(invoice.totalPaise), link: url });
  const wa = invoice.party.phone ? whatsappLink(invoice.party.phone, text) : null;
  const p = invoice.party;

  return (
    <>
      <div className="no-print">
        <PageHeader
          title={invoice.number}
          sub={
            <>
              <Link href={`/parties/${invoice.partyId}`} className="hover:underline">{invoice.party.name}</Link>
              {quote && <> · from <Link href={`/quotes/${quote.id}`} className="hover:underline">{quote.number}</Link></>}
              {pay && pay.status !== "CANCELLED" && <>{" · "}<span className={pay.status === "PAID" ? "text-got" : pay.status === "PART" ? "text-gave" : ""}>{pay.status === "PAID" ? "Paid" : pay.status === "PART" ? formatINR(pay.open) + " still due" : "Unpaid"}</span></>}
              {" · "}{invoice.viewCount > 0 ? `viewed ${invoice.viewCount}× · last ${fmtDate(invoice.lastViewedAt)}` : "not viewed yet"}
            </>
          }
          action={
            <div className="flex flex-wrap gap-2">
              <CopyLink url={url} />
              <PrintButton />
              {can(role, "invoice:write") && !cancelled && <Link href={`/notes/new?invoice=${invoice.id}`} className={buttonClass("secondary")}>Return note</Link>}
              {wa && !cancelled && <a href={wa} target="_blank" rel="noopener noreferrer" className={buttonClass("primary")}>Share on WhatsApp</a>}
            </div>
          }
        />
        {!cancelled && (
          <Card className="mb-4 flex flex-wrap items-center justify-between gap-3">
            {can(role, "reminder:send") && (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-muted">Send from the app:</span>
                <SendDocumentForm kind="INVOICE" id={invoice.id} blocked={{ WHATSAPP: blockedReason(p, "WHATSAPP"), SMS: blockedReason(p, "SMS"), EMAIL: blockedReason(p, "EMAIL") }} />
              </div>
            )}
            {can(role, "invoice:cancel") && <CancelInvoiceForm invoiceId={invoice.id} />}
          </Card>
        )}
        {cancelled && (
          <Card className="mb-4 text-sm text-muted">
            Cancelled {fmtDate(invoice.cancelledAt)}: {invoice.cancelReason}. {formatINR(invoice.totalPaise)} was reversed in the customer’s ledger.
          </Card>
        )}
      </div>
      <DocumentView doc={{ ...invoice, kind: "INVOICE" }} business={business} party={invoice.party} />
    </>
  );
}
