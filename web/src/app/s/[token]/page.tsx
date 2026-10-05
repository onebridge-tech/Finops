import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { db } from "@/lib/db";
import { statement } from "@/lib/statement";
import { formatINR } from "@/lib/money";
import { upiLink } from "@/lib/share";
import { fileUrl } from "@/lib/files";
import { STATES } from "@/lib/gstin";
import { fmtDate } from "@/components/ui";
import { Attachments } from "@/components/attachments";
import { PrintButton } from "@/components/print-button";
import { InviteCta } from "@/components/invite-cta";

// Public, read-only party statement (no login). Access is by unguessable token.
export const metadata = { title: "Statement", robots: { index: false } };

export default async function Statement({ params, searchParams }: PageProps<"/s/[token]">) {
  const { token } = await params;
  const sp = await searchParams;
  const party = await db.party.findUnique({ where: { shareToken: token }, include: { business: true } });
  if (!party || party.archivedAt) notFound();
  const b = party.business;
  const st = await statement(party.id, sp.from, sp.to);
  const balance = st.current;
  const pay = balance > 0 && b.upiId ? upiLink({ vpa: b.upiId, payee: b.name, amountPaise: balance, note: `Payment from ${party.name}` }) : null;
  const qr = pay ? await QRCode.toDataURL(pay, { margin: 1, width: 180 }) : null;
  const logo = fileUrl(b.logoFileId);
  const range = st.from || st.to ? `${st.from ? fmtDate(new Date(st.from)) : "Start"} – ${st.to ? fmtDate(new Date(st.to)) : "today"}` : "All transactions";
  const exportQs = new URLSearchParams(Object.entries({ from: st.from, to: st.to }).filter(([, v]) => v) as [string, string][]);

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 print:max-w-none print:py-0">
      <header className="mb-4 flex items-start gap-4 border-b-4 pb-4" style={{ borderColor: b.brandColor }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {logo && <img src={logo} alt="" className="h-14 w-auto rounded bg-white object-contain p-1" />}
        <div className="flex-1">
          <p className="text-xs uppercase tracking-wide text-muted">Account statement</p>
          <h1 className="text-2xl font-bold">{b.name}</h1>
          <p className="text-sm text-muted">
            {[b.address, STATES[b.stateCode], b.gstin && `GSTIN ${b.gstin}`, b.phone].filter(Boolean).join(" · ")}
          </p>
          <p className="mt-2 text-sm">For <span className="font-medium">{party.name}</span>{party.gstin && ` (GSTIN ${party.gstin})`} · {range}</p>
        </div>
      </header>

      <section className="rounded-xl border border-line bg-card p-5">
        {balance > 0 ? (
          <>
            <p className="text-sm text-muted">Amount due to {b.name} today</p>
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
              <a href={pay} className="no-print inline-block rounded-lg px-4 py-2 font-semibold text-white" style={{ background: b.brandColor }}>Pay {formatINR(balance)} by UPI</a>
              <p className="mt-2 text-xs text-muted">Scan with any UPI app. {b.upiId}</p>
            </div>
          </div>
        )}
      </section>

      <form className="no-print mt-6 flex flex-wrap items-end gap-2 text-sm">
        <label className="space-y-1"><span className="block text-xs text-muted">From</span><input type="date" name="from" defaultValue={st.from ?? ""} className="rounded-lg border border-line bg-card px-2 py-1.5" /></label>
        <label className="space-y-1"><span className="block text-xs text-muted">To</span><input type="date" name="to" defaultValue={st.to ?? ""} className="rounded-lg border border-line bg-card px-2 py-1.5" /></label>
        <button className="rounded-lg border border-line bg-card px-3 py-1.5 font-medium hover:bg-bg">Show</button>
        <span className="ml-auto flex flex-wrap gap-2">
          <PrintButton />
          <a href={`/s/${token}/export?${new URLSearchParams([...exportQs, ["format", "xlsx"]])}`} className="rounded-lg border border-line bg-card px-3.5 py-2 font-medium hover:bg-bg">Excel</a>
          <a href={`/s/${token}/export?${new URLSearchParams([...exportQs, ["format", "csv"]])}`} className="rounded-lg border border-line bg-card px-3.5 py-2 font-medium hover:bg-bg">CSV</a>
        </span>
      </form>

      <table className="mt-4 w-full rounded-xl border border-line bg-card text-sm">
        <thead className="border-b border-line text-left text-xs uppercase text-muted">
          <tr><th className="px-3 py-2">Date</th><th className="px-3 py-2">Details</th><th className="px-3 py-2 text-right">Debit</th><th className="px-3 py-2 text-right">Credit</th><th className="px-3 py-2 text-right">Balance</th></tr>
        </thead>
        <tbody className="divide-y divide-line">
          {st.from && (
            <tr className="text-muted"><td className="px-3 py-2">{fmtDate(new Date(st.from))}</td><td className="px-3 py-2" colSpan={3}>Balance brought forward</td><td className="px-3 py-2 text-right tabular-nums">{formatINR(st.opening)}</td></tr>
          )}
          {st.rows.length === 0 && <tr><td colSpan={5} className="px-3 py-4 text-center text-muted">No transactions in this period.</td></tr>}
          {st.rows.map((e) => (
            <tr key={e.id} className="align-top">
              <td className="whitespace-nowrap px-3 py-2">{fmtDate(e.date)}</td>
              <td className="px-3 py-2">
                {e.note ?? (e.direction === "GAVE" ? "Credit" : "Payment received")}
                <Attachments files={st.filesByEntry.get(e.id) ?? []} />
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-gave">{e.direction === "GAVE" ? formatINR(e.amountPaise) : ""}</td>
              <td className="px-3 py-2 text-right tabular-nums text-got">{e.direction === "GOT" ? formatINR(e.amountPaise) : ""}</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatINR(e.running)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot className="border-t border-line font-semibold">
          <tr><td className="px-3 py-2" colSpan={2}>Closing balance</td><td className="px-3 py-2 text-right tabular-nums">{formatINR(st.totalGave)}</td><td className="px-3 py-2 text-right tabular-nums">{formatINR(st.totalGot)}</td><td className="px-3 py-2 text-right tabular-nums">{formatINR(st.closing)}</td></tr>
        </tfoot>
      </table>
      <p className="mt-2 text-xs text-muted">Debit = amount you owe {b.name}; credit = payments and returns. A positive balance is due to {b.name}.</p>

      <p className="mt-6 text-center text-xs text-muted">Shared securely by {b.name}. Questions about an entry? Contact {b.phone ?? "the business"}.</p>
      <p className="no-print mt-2 text-center text-xs text-muted"><a href={`/o/${token}`} className="underline">Message preferences</a></p>
      <InviteCta businessId={b.id} businessName={b.name} />
    </main>
  );
}
