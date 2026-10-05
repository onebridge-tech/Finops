import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { balanceOf } from "@/lib/ledger";
import { formatINR } from "@/lib/money";
import { STATES } from "@/lib/gstin";
import { fmtDate, PAYMENT_MODE_LABEL, type PaymentMode } from "@/lib/format";
import { PrintButton } from "@/components/print-button";
import { InviteCta } from "@/components/invite-cta";

// Public payment receipt (CP-11). No login; access is by unguessable token.
export const metadata = { title: "Receipt", robots: { index: false } };

export default async function ReceiptPage({ params }: PageProps<"/r/[token]">) {
  const { token } = await params;
  const receipt = await db.receipt.findUnique({
    where: { shareToken: token },
    include: { business: true, party: true, entry: { include: { reversedBy: true } } },
  });
  if (!receipt) notFound();
  const { business: b, party } = receipt;
  const cancelled = !!receipt.entry.reversedBy;
  const balance = balanceOf(await db.ledgerEntry.findMany({ where: { partyId: party.id } }));

  return (
    <main className="mx-auto max-w-lg px-4 py-8">
      <article className="rounded-xl border border-line bg-card p-6 text-sm print:border-0">
        <header className="border-b border-line pb-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand">Payment receipt</p>
          <h1 className="mt-1 text-xl font-bold">{b.name}</h1>
          {b.address && <p className="text-muted">{b.address}</p>}
          <p className="text-muted">{STATES[b.stateCode]}{b.gstin && ` · GSTIN ${b.gstin}`}</p>
        </header>
        {cancelled && <p className="mt-4 rounded-lg bg-gave/10 px-3 py-2 font-medium text-gave">This receipt was cancelled.</p>}
        <dl className="mt-4 grid grid-cols-2 gap-y-2">
          <dt className="text-muted">Receipt no.</dt><dd className="text-right font-medium">{receipt.number}</dd>
          <dt className="text-muted">Date</dt><dd className="text-right">{fmtDate(receipt.date)}</dd>
          <dt className="text-muted">Received from</dt><dd className="text-right">{party.name}</dd>
          {receipt.mode && <><dt className="text-muted">Paid by</dt><dd className="text-right">{PAYMENT_MODE_LABEL[receipt.mode as PaymentMode] ?? receipt.mode}</dd></>}
          {receipt.entry.note && <><dt className="text-muted">Note</dt><dd className="text-right">{receipt.entry.note}</dd></>}
        </dl>
        <p className={`mt-6 border-t border-line pt-4 text-center text-3xl font-bold tabular-nums ${cancelled ? "text-muted line-through" : "text-got"}`}>
          {formatINR(receipt.amountPaise)}
        </p>
        <p className="mt-2 text-center text-muted">
          {balance > 0 ? `Balance still due: ${formatINR(balance)}` : balance < 0 ? `Advance with ${b.name}: ${formatINR(-balance)}` : "Account fully settled. Thank you!"}
        </p>
      </article>
      <div className="no-print mt-4 flex justify-center gap-3 text-sm">
        <PrintButton />
        <a href={`/s/${party.shareToken}`} className="self-center text-muted underline">View full statement</a>
      </div>
      <InviteCta businessId={b.id} businessName={b.name} />
    </main>
  );
}
