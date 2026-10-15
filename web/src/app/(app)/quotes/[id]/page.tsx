import { notFound } from "next/navigation";
import Link from "next/link";
import { can, docWhere, requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import { appUrl, whatsappLink } from "@/lib/share";
import { renderFor } from "@/lib/messaging/render";
import { blockedReason } from "@/lib/messaging/send";
import { convertQuote, setQuoteStatus } from "@/app/actions/billing";
import { quoteToOrder } from "@/app/actions/orders";
import { DocumentView } from "@/components/document-view";
import { SendDocumentForm } from "@/components/document-actions";
import { PrintButton } from "@/components/print-button";
import { Card, PageHeader, buttonClass, fmtDate } from "@/components/ui";
import { CopyLink } from "../../parties/[id]/reminder";
import { quoteStatus } from "../status";

export const metadata = { title: "Price quote" };

export default async function QuotePage({ params }: PageProps<"/quotes/[id]">) {
  const { id } = await params;
  const ctx = await requireBusiness();
  const { business, role } = ctx;
  const quote = await db.quote.findFirst({ where: { ...docWhere(ctx), id }, include: { lines: true, party: true } });
  if (!quote) notFound();

  const url = appUrl(`/q/${quote.shareToken}`);
  const p = quote.party;
  const text = await renderFor(business.id, "QUOTE", p.language, { party: p.name, business: business.name, number: quote.number, amountPaise: Number(quote.totalPaise), link: url });
  const wa = p.phone ? whatsappLink(p.phone, text) : null;
  const s = quoteStatus(quote);
  const open = quote.status === "OPEN" || quote.status === "ACCEPTED";
  const write = can(role, "invoice:write");


  return (
    <>
      <div className="no-print">
        <PageHeader
          title={quote.number}
          sub={
            <>
              <Link href={`/parties/${quote.partyId}`} className="hover:underline">{p.name}</Link>
              {" · "}<span className={s.tone}>{s.label}</span>
              {quote.respondedAt && ` on ${fmtDate(quote.respondedAt)}`}{quote.responderName && ` by ${quote.responderName}`}
            </>
          }
          action={
            <div className="flex flex-wrap gap-2">
              <CopyLink url={url} />
              <PrintButton />
              {wa && quote.status === "OPEN" && <a href={wa} target="_blank" rel="noopener noreferrer" className={buttonClass("secondary")}>Share on WhatsApp</a>}
              {write && open && (
                <form action={convertQuote}>
                  <input type="hidden" name="quoteId" value={quote.id} />
                  <button className={buttonClass("primary")}>Make this a bill</button>
                </form>
              )}
              {write && open && (
                <form action={quoteToOrder}>
                  <input type="hidden" name="quoteId" value={quote.id} />
                  <button className={buttonClass("secondary")}>Make an order</button>
                </form>
              )}
            </div>
          }
        />
        <Card className="mb-4 flex flex-wrap items-center justify-between gap-3">
          {quote.status === "CONVERTED" && quote.convertedInvoiceId ? (
            <p className="text-sm">Billed as <Link href={`/invoices/${quote.convertedInvoiceId}`} className="font-medium underline">this invoice</Link>.</p>
          ) : (
            <>
              {can(role, "reminder:send") && quote.status === "OPEN" && (
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-muted">Send from the app:</span>
                  <SendDocumentForm kind="QUOTE" id={quote.id} blocked={{ WHATSAPP: blockedReason(p, "WHATSAPP"), SMS: blockedReason(p, "SMS"), EMAIL: blockedReason(p, "EMAIL") }} />
                </div>
              )}
              {write && (
                <div className="flex gap-3">
                  {quote.status !== "ACCEPTED" && <StatusButton quoteId={quote.id} status="ACCEPTED">Mark accepted</StatusButton>}
                  {quote.status !== "DECLINED" && <StatusButton quoteId={quote.id} status="DECLINED">Mark declined</StatusButton>}
                  {quote.status !== "OPEN" && <StatusButton quoteId={quote.id} status="OPEN">Reopen</StatusButton>}
                </div>
              )}
            </>
          )}
        </Card>
      </div>
      <DocumentView doc={{ ...quote, kind: "QUOTE", dueDate: quote.validUntil }} business={business} party={p} />
    </>
  );
}

function StatusButton({ quoteId, status, children }: { quoteId: string; status: string; children: string }) {
  return (
    <form action={setQuoteStatus}>
      <input type="hidden" name="quoteId" value={quoteId} />
      <input type="hidden" name="status" value={status} />
      <button className="text-sm text-muted underline hover:text-ink">{children}</button>
    </form>
  );
}
