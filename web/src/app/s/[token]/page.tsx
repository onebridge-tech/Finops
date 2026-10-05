import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { db } from "@/lib/db";
import { balanceOf, reversedIds, withRunningBalance } from "@/lib/ledger";
import { formatINR } from "@/lib/money";
import { upiLink } from "@/lib/share";
import { fmtDate } from "@/components/ui";

// Public, read-only party statement (no login). Access is by unguessable token.
export const metadata = { title: "Statement", robots: { index: false } };

export default async function Statement({ params }: PageProps<"/s/[token]">) {
  const { token } = await params;
  const party = await db.party.findUnique({ where: { shareToken: token }, include: { business: true } });
  if (!party || party.archivedAt) notFound();
  const entries = await db.ledgerEntry.findMany({ where: { partyId: party.id }, orderBy: [{ date: "asc" }, { createdAt: "asc" }] });
  const b = party.business;
  const balance = balanceOf(entries);
  const struck = reversedIds(entries);
  const rows = withRunningBalance(entries.filter((e) => !struck.has(e.id))).reverse();
  const pay = balance > 0 && b.upiId ? upiLink({ vpa: b.upiId, payee: b.name, amountPaise: balance, note: `Payment from ${party.name}` }) : null;
  const qr = pay ? await QRCode.toDataURL(pay, { margin: 1, width: 180 }) : null;

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <header className="mb-4">
        <p className="text-xs uppercase tracking-wide text-muted">Account statement</p>
        <h1 className="text-2xl font-bold">{b.name}</h1>
        {b.gstin && <p className="text-sm text-muted">GSTIN {b.gstin}</p>}
        <p className="mt-2 text-sm">For <span className="font-medium">{party.name}</span> · as of {fmtDate(new Date())}</p>
      </header>

      <section className="rounded-xl border border-line bg-card p-5">
        {balance > 0 ? (
          <>
            <p className="text-sm text-muted">Amount due to {b.name}</p>
            <p className="text-3xl font-bold tabular-nums text-gave">{formatINR(balance)}</p>
          </>
        ) : balance < 0 ? (
          <>
            <p className="text-sm text-muted">{b.name} owes you</p>
            <p className="text-3xl font-bold tabular-nums text-got">{formatINR(-balance)}</p>
          </>
        ) : (
          <p className="text-lg font-semibold text-got">All settled. Thank you!</p>
        )}
        {pay && qr && (
          <div className="mt-4 flex items-center gap-4 border-t border-line pt-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt="UPI QR code" width={120} height={120} className="rounded bg-white p-1" />
            <div>
              <a href={pay} className="inline-block rounded-lg bg-brand px-4 py-2 font-semibold text-brand-ink">Pay {formatINR(balance)} by UPI</a>
              <p className="mt-2 text-xs text-muted">Opens your UPI app on mobile. On a computer, scan the QR.</p>
            </div>
          </div>
        )}
      </section>

      <h2 className="mb-2 mt-6 font-semibold">Transactions</h2>
      <div className="divide-y divide-line rounded-xl border border-line bg-card text-sm">
        {rows.length === 0 && <p className="p-4 text-muted">No transactions.</p>}
        {rows.map((e) => (
          <div key={e.id} className="flex justify-between gap-3 px-4 py-3">
            <span>
              <span className="block">{e.note ?? (e.direction === "GAVE" ? "Credit" : "Payment received")}</span>
              <span className="text-xs text-muted">{fmtDate(e.date)}</span>
            </span>
            <span className="text-right">
              <span className={`block tabular-nums ${e.direction === "GAVE" ? "text-gave" : "text-got"}`}>
                {e.direction === "GAVE" ? "" : "−"}{formatINR(e.amountPaise)}
              </span>
              <span className="text-xs text-muted">Bal {formatINR(e.running)}</span>
            </span>
          </div>
        ))}
      </div>
      <p className="mt-6 text-center text-xs text-muted">Shared securely by {b.name}. Questions about an entry? Contact {b.phone ?? "the business"}.</p>
      <p className="mt-2 text-center text-xs text-muted"><a href={`/o/${token}`} className="underline">Message preferences</a></p>
    </main>
  );
}
