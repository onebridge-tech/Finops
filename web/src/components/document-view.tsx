import QRCode from "qrcode";
import type { CSSProperties } from "react";
import type { Business, Party } from "@prisma/client";
import { formatINR } from "@/lib/money";
import { STATES } from "@/lib/gstin";
import { upiLink } from "@/lib/share";
import { amountInWords } from "@/lib/words";
import { fileUrl } from "@/lib/files";
import { fmtDate } from "@/lib/format";

type Line = {
  id: string; description: string; hsn: string | null; qtyMilli: number; unit: string;
  ratePaise: bigint; taxRateBp: number; discountBp: number; taxablePaise: bigint; totalPaise: bigint;
};

export type Doc = {
  kind: "INVOICE" | "QUOTE" | "SALES_ORDER" | "PURCHASE_ORDER" | "CREDIT_NOTE" | "DEBIT_NOTE";
  sellerGstin?: string | null; // the GSTIN the document was issued under (BD-10)
  sellerStateCode?: string | null;
  number: string;
  date: Date;
  dueDate: Date | null; // invoice due date or quotation validity
  placeOfSupply: string;
  interState: boolean;
  taxablePaise: bigint; cgstPaise: bigint; sgstPaise: bigint; igstPaise: bigint; roundOffPaise: bigint; totalPaise: bigint;
  notes: string | null;
  status: string;
  lines: Line[];
};

type Props = { doc: Doc; business: Business; party: Party; payAmountPaise?: number | null };

/** Printable GST invoice or quotation with the business's branding (BD-03, BD-04). */
export async function DocumentView({ doc, business: b, party, payAmountPaise }: Props) {
  const isInvoice = doc.kind === "INVOICE";
  const cancelled = doc.status === "CANCELLED";
  const payAmount = isInvoice && !cancelled ? (payAmountPaise ?? Number(doc.totalPaise)) : 0;
  const pay = b.upiId && payAmount > 0 ? upiLink({ vpa: b.upiId, payee: b.name, amountPaise: payAmount, note: doc.number }) : null;
  const qr = pay ? await QRCode.toDataURL(pay, { margin: 1, width: 160 }) : null;
  const logo = fileUrl(b.logoFileId);
  const signature = fileUrl(b.signatureFileId);
  const n = (v: bigint) => formatINR(v);
  const t = b.docTemplate;
  const compact = t === "COMPACT";
  const modern = t === "MODERN";
  const style = { "--doc-brand": b.brandColor } as CSSProperties;
  const gstin = doc.sellerGstin ?? b.gstin;
  const sellerState = doc.sellerStateCode ?? b.stateCode;
  const title = { INVOICE: gstin ? "Tax Invoice" : "Invoice", QUOTE: "Quotation", SALES_ORDER: "Sales Order", PURCHASE_ORDER: "Purchase Order", CREDIT_NOTE: "Credit Note", DEBIT_NOTE: "Debit Note" }[doc.kind];
  const dateLabel = { INVOICE: "Due", QUOTE: "Valid until", SALES_ORDER: "Expected", PURCHASE_ORDER: "Expected", CREDIT_NOTE: "", DEBIT_NOTE: "" }[doc.kind];
  const hasBank = b.bankAccountNo && b.bankIfsc;
  const hasDiscount = doc.lines.some((l) => l.discountBp > 0);

  return (
    <article style={style} className={`relative overflow-hidden rounded-xl border border-line bg-card ${compact ? "p-4 text-xs" : "p-6 text-sm"} print:border-0 print:p-0`}>
      {cancelled && (
        <p className="mb-4 rounded-lg bg-gave/10 px-3 py-2 text-center font-semibold uppercase tracking-wide text-gave">Cancelled</p>
      )}
      <header className={`flex flex-wrap justify-between gap-4 pb-4 ${modern ? "-mx-6 -mt-6 mb-4 px-6 pt-6 text-white" : "border-b border-line"}`}
        style={modern ? { background: "var(--doc-brand)" } : undefined}>
        <div className="flex gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {logo && <img src={logo} alt="" className={`${compact ? "h-10" : "h-14"} w-auto rounded bg-white object-contain p-1`} />}
          <div>
            <h2 className={`${compact ? "text-base" : "text-lg"} font-bold`}>{b.name}</h2>
            {b.address && <p className={modern ? "opacity-90" : "text-muted"}>{b.address}</p>}
            <p className={modern ? "opacity-90" : "text-muted"}>{STATES[sellerState]} ({sellerState}){b.phone && ` · ${b.phone}`}{b.email && ` · ${b.email}`}</p>
            {gstin && <p>GSTIN: <span className="font-mono">{gstin}</span></p>}
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs font-semibold uppercase tracking-wide" style={modern ? undefined : { color: "var(--doc-brand)" }}>{title}</p>
          <p className="text-lg font-semibold">{doc.number}</p>
          <p>Date: {fmtDate(doc.date)}</p>
          {doc.dueDate && dateLabel && <p>{dateLabel}: {fmtDate(doc.dueDate)}</p>}
        </div>
      </header>

      <section className="grid gap-4 border-b border-line py-4 sm:grid-cols-2">
        <div>
          <p className="text-xs uppercase text-muted">{doc.kind === "PURCHASE_ORDER" ? "Supplier" : doc.kind === "INVOICE" || doc.kind === "DEBIT_NOTE" ? "Bill to" : doc.kind === "CREDIT_NOTE" ? "Credit to" : "Prepared for"}</p>
          <p className="font-semibold">{party.name}</p>
          {party.address && <p className="text-muted">{party.address}</p>}
          {party.gstin && <p>GSTIN: <span className="font-mono">{party.gstin}</span></p>}
        </div>
        <div className="sm:text-right">
          <p className="text-xs uppercase text-muted">Place of supply</p>
          <p>{STATES[doc.placeOfSupply]} ({doc.placeOfSupply})</p>
        </div>
      </section>

      <div className="overflow-x-auto">
        <table className="mt-4 w-full min-w-[560px]">
          <thead className="text-left text-xs text-muted" style={modern ? { background: "color-mix(in srgb, var(--doc-brand) 10%, transparent)" } : undefined}>
            <tr className="border-b border-line">
              <th className="p-2">#</th><th className="p-2">Description</th><th className="p-2">HSN/SAC</th>
              <th className="p-2 text-right">Qty</th><th className="p-2 text-right">Rate</th>{hasDiscount && <th className="p-2 text-right">Disc</th>}<th className="p-2 text-right">Taxable</th>
              <th className="p-2 text-right">GST</th><th className="p-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {doc.lines.map((l, i) => (
              <tr key={l.id}>
                <td className={compact ? "px-2 py-1" : "p-2"}>{i + 1}</td>
                <td className={compact ? "px-2 py-1" : "p-2"}>{l.description}</td>
                <td className={compact ? "px-2 py-1" : "p-2"}>{l.hsn ?? "—"}</td>
                <td className={`${compact ? "px-2 py-1" : "p-2"} text-right tabular-nums`}>{l.qtyMilli / 1000} {l.unit}</td>
                <td className={`${compact ? "px-2 py-1" : "p-2"} text-right tabular-nums`}>{n(l.ratePaise)}</td>
                {hasDiscount && <td className={`${compact ? "px-2 py-1" : "p-2"} text-right`}>{l.discountBp ? `${l.discountBp / 100}%` : ""}</td>}
                <td className={`${compact ? "px-2 py-1" : "p-2"} text-right tabular-nums`}>{n(l.taxablePaise)}</td>
                <td className={`${compact ? "px-2 py-1" : "p-2"} text-right`}>{l.taxRateBp / 100}%</td>
                <td className={`${compact ? "px-2 py-1" : "p-2"} text-right tabular-nums`}>{n(l.totalPaise)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="mt-4 flex flex-wrap items-start justify-between gap-6 border-t border-line pt-4">
        <div className="space-y-3">
          {qr && pay && (
            <div className="flex items-center gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qr} alt="UPI QR code" width={compact ? 90 : 120} height={compact ? 90 : 120} className="rounded bg-white p-1" />
              <div>
                <p className="font-medium">Scan to pay with any UPI app</p>
                <p className="text-muted">{b.upiId}</p>
                <a href={pay} className="no-print mt-2 inline-block rounded-lg px-3 py-1.5 font-medium text-white" style={{ background: "var(--doc-brand)" }}>Pay now</a>
              </div>
            </div>
          )}
          {hasBank && (
            <div>
              <p className="text-xs uppercase text-muted">Bank transfer</p>
              <p>{b.bankAccountName ?? b.name}</p>
              <p>A/c {b.bankAccountNo} · IFSC {b.bankIfsc}{b.bankName && ` · ${b.bankName}`}</p>
            </div>
          )}
        </div>
        <dl className="min-w-56 space-y-1">
          <div className="flex justify-between gap-6"><dt className="text-muted">Taxable value</dt><dd className="tabular-nums">{n(doc.taxablePaise)}</dd></div>
          {doc.interState ? (
            <div className="flex justify-between gap-6"><dt className="text-muted">IGST</dt><dd className="tabular-nums">{n(doc.igstPaise)}</dd></div>
          ) : (
            <>
              <div className="flex justify-between gap-6"><dt className="text-muted">CGST</dt><dd className="tabular-nums">{n(doc.cgstPaise)}</dd></div>
              <div className="flex justify-between gap-6"><dt className="text-muted">SGST</dt><dd className="tabular-nums">{n(doc.sgstPaise)}</dd></div>
            </>
          )}
          <div className="flex justify-between gap-6"><dt className="text-muted">Round off</dt><dd className="tabular-nums">{n(doc.roundOffPaise)}</dd></div>
          <div className="flex justify-between gap-6 border-t border-line pt-1 text-base font-semibold"><dt>Total</dt><dd className="tabular-nums">{n(doc.totalPaise)}</dd></div>
        </dl>
      </section>
      <p className="mt-3 text-right text-xs italic text-muted">{amountInWords(Number(doc.totalPaise))}</p>

      {(doc.notes || b.docTerms) && (
        <section className="mt-4 space-y-2 border-t border-line pt-3 text-muted">
          {doc.notes && <p className="whitespace-pre-line">{doc.notes}</p>}
          {b.docTerms && <p className="whitespace-pre-line text-xs"><span className="font-medium">Terms: </span>{b.docTerms}</p>}
        </section>
      )}

      <footer className="mt-6 flex justify-end">
        <div className="text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {signature && <img src={signature} alt="" className="mx-auto h-12 w-auto object-contain" />}
          <p className="mt-1 border-t border-line pt-1 text-xs text-muted">For {b.name} · Authorised signatory</p>
        </div>
      </footer>
    </article>
  );
}
