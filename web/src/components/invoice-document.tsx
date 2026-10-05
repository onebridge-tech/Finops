import QRCode from "qrcode";
import type { Business, Invoice, InvoiceLine, Party } from "@prisma/client";
import { formatINR } from "@/lib/money";
import { STATES } from "@/lib/gstin";
import { upiLink } from "@/lib/share";
import { fmtDate } from "./ui";

type Props = { invoice: Invoice & { lines: InvoiceLine[] }; business: Business; party: Party; balanceDuePaise?: number };

/** Printable GST tax invoice, used both in the app and on the public link. */
export async function InvoiceDocument({ invoice, business, party, balanceDuePaise }: Props) {
  const pay = business.upiId
    ? upiLink({ vpa: business.upiId, payee: business.name, amountPaise: balanceDuePaise ?? Number(invoice.totalPaise), note: invoice.number })
    : null;
  const qr = pay ? await QRCode.toDataURL(pay, { margin: 1, width: 160 }) : null;
  const n = (v: bigint) => formatINR(v);

  return (
    <article className="rounded-xl border border-line bg-card p-6 text-sm print:border-0 print:p-0">
      <header className="flex flex-wrap justify-between gap-4 border-b border-line pb-4">
        <div>
          <h2 className="text-lg font-bold">{business.name}</h2>
          {business.address && <p className="text-muted">{business.address}</p>}
          <p className="text-muted">{STATES[business.stateCode]} ({business.stateCode})</p>
          {business.gstin && <p>GSTIN: <span className="font-mono">{business.gstin}</span></p>}
          {business.phone && <p className="text-muted">{business.phone}</p>}
        </div>
        <div className="text-right">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand">Tax Invoice</p>
          <p className="text-lg font-semibold">{invoice.number}</p>
          <p>Date: {fmtDate(invoice.date)}</p>
          {invoice.dueDate && <p>Due: {fmtDate(invoice.dueDate)}</p>}
        </div>
      </header>

      <section className="grid gap-4 border-b border-line py-4 sm:grid-cols-2">
        <div>
          <p className="text-xs uppercase text-muted">Bill to</p>
          <p className="font-semibold">{party.name}</p>
          {party.address && <p className="text-muted">{party.address}</p>}
          {party.gstin && <p>GSTIN: <span className="font-mono">{party.gstin}</span></p>}
        </div>
        <div className="sm:text-right">
          <p className="text-xs uppercase text-muted">Place of supply</p>
          <p>{STATES[invoice.placeOfSupply]} ({invoice.placeOfSupply})</p>
        </div>
      </section>

      <div className="overflow-x-auto">
        <table className="mt-4 w-full min-w-[560px]">
          <thead className="border-b border-line text-left text-xs uppercase text-muted">
            <tr>
              <th className="py-2">#</th><th className="py-2">Description</th><th className="py-2">HSN/SAC</th>
              <th className="py-2 text-right">Qty</th><th className="py-2 text-right">Rate</th><th className="py-2 text-right">Taxable</th>
              <th className="py-2 text-right">GST</th><th className="py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {invoice.lines.map((l, i) => (
              <tr key={l.id}>
                <td className="py-2">{i + 1}</td>
                <td className="py-2">{l.description}</td>
                <td className="py-2">{l.hsn ?? "—"}</td>
                <td className="py-2 text-right tabular-nums">{l.qtyMilli / 1000} {l.unit}</td>
                <td className="py-2 text-right tabular-nums">{n(l.ratePaise)}</td>
                <td className="py-2 text-right tabular-nums">{n(l.taxablePaise)}</td>
                <td className="py-2 text-right">{l.taxRateBp / 100}%</td>
                <td className="py-2 text-right tabular-nums">{n(l.totalPaise)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="mt-4 flex flex-wrap items-start justify-between gap-6 border-t border-line pt-4">
        <div className="flex items-center gap-4">
          {qr && pay && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qr} alt="UPI QR code" width={120} height={120} className="rounded bg-white p-1" />
              <div>
                <p className="font-medium">Scan to pay with any UPI app</p>
                <p className="text-muted">{business.upiId}</p>
                <a href={pay} className="no-print mt-2 inline-block rounded-lg bg-brand px-3 py-1.5 font-medium text-brand-ink">Pay now</a>
              </div>
            </>
          )}
        </div>
        <dl className="min-w-56 space-y-1">
          <div className="flex justify-between gap-6"><dt className="text-muted">Taxable value</dt><dd className="tabular-nums">{n(invoice.taxablePaise)}</dd></div>
          {invoice.interState ? (
            <div className="flex justify-between gap-6"><dt className="text-muted">IGST</dt><dd className="tabular-nums">{n(invoice.igstPaise)}</dd></div>
          ) : (
            <>
              <div className="flex justify-between gap-6"><dt className="text-muted">CGST</dt><dd className="tabular-nums">{n(invoice.cgstPaise)}</dd></div>
              <div className="flex justify-between gap-6"><dt className="text-muted">SGST</dt><dd className="tabular-nums">{n(invoice.sgstPaise)}</dd></div>
            </>
          )}
          <div className="flex justify-between gap-6"><dt className="text-muted">Round off</dt><dd className="tabular-nums">{n(invoice.roundOffPaise)}</dd></div>
          <div className="flex justify-between gap-6 border-t border-line pt-1 text-base font-semibold"><dt>Total</dt><dd className="tabular-nums">{n(invoice.totalPaise)}</dd></div>
        </dl>
      </section>
      {invoice.notes && <p className="mt-4 whitespace-pre-line border-t border-line pt-3 text-muted">{invoice.notes}</p>}
    </article>
  );
}
