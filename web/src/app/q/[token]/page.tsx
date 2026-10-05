import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { trackView } from "@/lib/views";
import { DocumentView } from "@/components/document-view";
import { PrintButton } from "@/components/print-button";
import { fmtDate } from "@/lib/format";
import { QuoteResponse } from "./response";
import { InviteCta } from "@/components/invite-cta";

// Public quotation with Accept / Decline (BD-01). No login; access is by unguessable token.
export const metadata = { title: "Quotation", robots: { index: false } };

export default async function PublicQuote({ params }: PageProps<"/q/[token]">) {
  const { token } = await params;
  const quote = await db.quote.findUnique({ where: { shareToken: token }, include: { lines: true, party: true, business: true } });
  if (!quote) notFound();
  await trackView("quote", quote.id, quote.businessId);
  const expired = quote.status === "OPEN" && quote.validUntil && quote.validUntil < new Date();

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <section className="no-print mb-4 rounded-xl border border-line bg-card p-4 text-sm">
        {quote.status === "OPEN" && !expired && <QuoteResponse token={token} business={quote.business.name} />}
        {expired && <p>This quotation expired on {fmtDate(quote.validUntil)}. Please ask {quote.business.name} for a fresh one.</p>}
        {(quote.status === "ACCEPTED" || quote.status === "CONVERTED") && (
          <p className="font-medium text-got">Accepted{quote.responderName && ` by ${quote.responderName}`}{quote.respondedAt && ` on ${fmtDate(quote.respondedAt)}`}. Thank you!</p>
        )}
        {quote.status === "DECLINED" && <p className="text-muted">You declined this quotation. Contact {quote.business.name} if you’d like a revised one.</p>}
      </section>
      <DocumentView doc={{ ...quote, kind: "QUOTE", dueDate: quote.validUntil }} business={quote.business} party={quote.party} />
      <div className="no-print mt-4 flex justify-center"><PrintButton /></div>
      <InviteCta businessId={quote.businessId} businessName={quote.business.name} />
    </main>
  );
}
