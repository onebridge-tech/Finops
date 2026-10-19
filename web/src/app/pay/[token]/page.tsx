import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { formatINR } from "@/lib/money";
import { gatewayMode } from "@/lib/payments/gateway";
import { completeTestPayment } from "@/app/actions/pay";

export const metadata = { title: "Payment", robots: { index: false } };

export default async function PayPage({ params }: PageProps<"/pay/[token]">) {
  const { token } = await params;
  const pay = await db.payment.findUnique({ where: { token } });
  if (!pay) notFound();
  const [business, party, receipt] = await Promise.all([
    db.business.findUniqueOrThrow({ where: { id: pay.businessId } }),
    db.party.findUniqueOrThrow({ where: { id: pay.partyId } }),
    pay.entryId ? db.receipt.findFirst({ where: { entryId: pay.entryId } }) : null,
  ]);
  const test = pay.provider === "test" && gatewayMode() === "test";
  return (
    <main className="mx-auto max-w-md px-4 py-10 text-center">
      <p className="text-sm text-muted">Payment to</p>
      <h1 className="text-xl font-bold">{business.name}</h1>
      <p className="mt-4 text-3xl font-bold tabular-nums">{formatINR(Number(pay.amountPaise))}</p>
      <p className="text-sm text-muted">for {party.name}</p>
      {pay.status === "PAID" ? (
        <div className="mt-6 rounded-xl border border-line bg-card p-5">
          <p className="text-lg font-semibold text-got">Payment received. Thank you!</p>
          {receipt && <a href={`/r/${receipt.shareToken}`} className="mt-2 inline-block text-sm text-brand underline">View receipt {receipt.number}</a>}
        </div>
      ) : pay.status === "FAILED" ? (
        <p className="mt-6 rounded-xl border border-line bg-card p-5 text-gave">This payment did not go through. Please try again from your bill or account link.</p>
      ) : test ? (
        <form action={completeTestPayment} className="mt-6 rounded-xl border border-dashed border-line bg-card p-5">
          <input type="hidden" name="token" value={token} />
          <p className="mb-3 text-sm text-muted">Test mode: no money is taken.</p>
          <button className="rounded-lg bg-brand px-4 py-2 font-semibold text-brand-ink">Pay {formatINR(Number(pay.amountPaise))} (test)</button>
        </form>
      ) : (
        <p className="mt-6 rounded-xl border border-line bg-card p-5 text-sm text-muted">Waiting for your payment to be confirmed. Refresh this page in a moment.</p>
      )}
    </main>
  );
}
