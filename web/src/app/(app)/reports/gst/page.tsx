import Link from "next/link";
import type { ReactNode } from "react";
import { requireBusiness } from "@/lib/auth";
import { loadGst } from "@/lib/gst-data";
import { isMonth, monthLabel, shiftMonth } from "@/lib/finance";
import { istDay } from "@/lib/ledger";
import { formatINR } from "@/lib/money";
import { STATES } from "@/lib/gstin";
import { Badge, Card, PageHeader, SectionTitle, StatCard, buttonClass } from "@/components/ui";
import { Icon } from "@/components/icon";

export const metadata = { title: "GST returns" };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const rate = (bp: number) => `${bp / 100}%`;

function Table({ head, children, empty }: { head: string[]; children: ReactNode; empty?: boolean }) {
  if (empty) return <Card className="text-sm text-muted">Nothing in this section for the month.</Card>;
  return (
    <Card className="overflow-x-auto p-0">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="border-b border-line text-left text-xs font-medium text-muted"><tr>{head.map((h, i) => <th key={`${h}${i}`} className={`px-3 py-2 ${i > 1 ? "text-right" : ""}`}>{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-line tabular-nums">{children}</tbody>
      </table>
    </Card>
  );
}
const R = ({ children }: { children: ReactNode }) => <td className="px-3 py-2 text-right">{children}</td>;
const L = ({ children }: { children: ReactNode }) => <td className="px-3 py-2">{children}</td>;

export default async function GstReturns({ searchParams }: PageProps<"/reports/gst">) {
  const sp = await searchParams;
  const ctx = await requireBusiness("reports:view");
  const m = isMonth(one(sp.m)) ? one(sp.m) : istDay(new Date()).slice(0, 7);
  const { gstr1: g1, gstr3b: g3, purchases } = await loadGst(ctx, m);
  const outTax = g3.outward.cgst + g3.outward.sgst + g3.outward.igst;
  const cnTax = g3.creditNotes.cgst + g3.creditNotes.sgst + g3.creditNotes.igst;
  const itc = g3.itc.cgst + g3.itc.sgst + g3.itc.igst;
  const q = `m=${m}`;

  return (
    <>
      <PageHeader
        title="GST returns"
        sub={`${monthLabel(m)} · prepared from your bills, return notes and supplier bills`}
        action={
          <span className="flex flex-wrap gap-2">
            <a href={`/reports/gst/export?${q}&format=xlsx`} className={buttonClass("secondary")}><Icon name="download" size={16} />Excel</a>
            <a href={`/reports/gst/export?${q}&format=gstr1`} className={buttonClass("secondary")}><Icon name="download" size={16} />GSTR-1 file (JSON)</a>
          </span>
        }
      />
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Link href={`/reports/gst?m=${shiftMonth(m, -1)}`} aria-label="Earlier month" className="flex size-9 items-center justify-center rounded-lg border border-line bg-card shadow-sm hover:bg-bg"><Icon name="chevron" size={16} className="rotate-180" /></Link>
        <form className="flex items-center gap-2"><input type="month" name="m" defaultValue={m} aria-label="Month" className="h-9 rounded-lg border border-line bg-card px-2.5 text-sm shadow-sm" /><button className={buttonClass("secondary")}>Show</button></form>
        <Link href={`/reports/gst?m=${shiftMonth(m, 1)}`} aria-label="Later month" className="flex size-9 items-center justify-center rounded-lg border border-line bg-card shadow-sm hover:bg-bg"><Icon name="chevron" size={16} /></Link>
      </div>

      <Card className="mb-5 border-warn/30 bg-warn/5 text-sm">
        <p className="font-medium">These figures are prepared from what you entered.</p>
        <p className="text-muted">Check them, or give the Excel file to your accountant, before you file on the GST portal. {!ctx.business.gstin && <>Your shop’s GSTIN is not set, so the GSTR-1 file cannot be made. <Link href="/settings" className="font-medium text-brand underline">Add it in Settings</Link>.</>}</p>
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon="bill" label="Tax on your sales" value={formatINR(outTax)} hint={`${g1.totals.invoices} bill${g1.totals.invoices === 1 ? "" : "s"}, ${formatINR(g3.outward.taxable)} before GST`} />
        <StatCard icon="undo" label="Less: return notes" value={formatINR(cnTax)} hint="Tax given back on returned goods" />
        <StatCard icon="check" label="Less: tax you paid suppliers" value={formatINR(itc)} tone="got" hint={`${purchases.length} supplier bill${purchases.length === 1 ? "" : "s"}`} />
        <StatCard icon="rupee" label="Tax to pay" value={formatINR(g3.payable.total)} tone={g3.payable.total > 0 ? "gave" : "got"} hint="Before the cross-use of credit on the portal" />
      </div>

      {g1.warnings.length > 0 && (
        <Card className="mt-4 border-warn/30 bg-warn/5 text-sm">
          <p className="font-medium">{g1.warnings.length} thing{g1.warnings.length === 1 ? "" : "s"} to fix before filing</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-muted">{g1.warnings.slice(0, 8).map((w) => <li key={w}>{w}</li>)}</ul>
        </Card>
      )}

      <SectionTitle>GSTR-3B summary</SectionTitle>
      <Table head={["Section", "", "Taxable value", "IGST", "CGST", "SGST"]}>
        <tr><L>3.1(a)</L><L>Outward taxable supplies</L><R>{formatINR(g3.outward.taxable)}</R><R>{formatINR(g3.outward.igst)}</R><R>{formatINR(g3.outward.cgst)}</R><R>{formatINR(g3.outward.sgst)}</R></tr>
        <tr><L>3.1(c)</L><L>Nil-rated supplies (0% items)</L><R>{formatINR(g3.nilRated.taxable)}</R><R>—</R><R>—</R><R>—</R></tr>
        <tr><L>{""}</L><L>Less: return notes (credit notes)</L><R>{formatINR(g3.creditNotes.taxable)}</R><R>{formatINR(g3.creditNotes.igst)}</R><R>{formatINR(g3.creditNotes.cgst)}</R><R>{formatINR(g3.creditNotes.sgst)}</R></tr>
        <tr><L>4(A)(5)</L><L>Input tax credit from supplier bills</L><R>—</R><R>{formatINR(g3.itc.igst)}</R><R>{formatINR(g3.itc.cgst)}</R><R>{formatINR(g3.itc.sgst)}</R></tr>
        <tr><L>4(D)</L><L>Credit that cannot be claimed</L><R>—</R><R>{formatINR(g3.itcBlocked.igst)}</R><R>{formatINR(g3.itcBlocked.cgst)}</R><R>{formatINR(g3.itcBlocked.sgst)}</R></tr>
        <tr className="font-semibold"><L>6.1</L><L>Tax payable</L><R>—</R><R>{formatINR(g3.payable.igst)}</R><R>{formatINR(g3.payable.cgst)}</R><R>{formatINR(g3.payable.sgst)}</R></tr>
        {g3.carryForward.igst + g3.carryForward.cgst + g3.carryForward.sgst > 0 && <tr className="text-muted"><L>{""}</L><L>Credit left over for next month</L><R>—</R><R>{formatINR(g3.carryForward.igst)}</R><R>{formatINR(g3.carryForward.cgst)}</R><R>{formatINR(g3.carryForward.sgst)}</R></tr>}
      </Table>
      <p className="mt-2 text-xs text-muted">Missing supplier bills lower your credit and raise the tax to pay. <Link href="/purchases" className="font-medium text-brand underline">Add or check supplier bills</Link>.</p>

      <SectionTitle>GSTR-1: sales to businesses with a GSTIN (B2B)</SectionTitle>
      <Table head={["Invoice", "Customer", "Date", "Taxable value", "IGST", "CGST", "SGST", "Total"]} empty={g1.b2b.length === 0}>
        {g1.b2b.flatMap((c) => c.invoices.map(({ doc, rates }) => (
          <tr key={doc.number}><L>{doc.number}</L><L><span className="font-medium">{doc.partyName}</span><span className="block text-xs text-muted">{c.gstin}</span></L><R>{doc.date}</R><R>{formatINR(rates.reduce((s, r) => s + r.taxable, 0))}</R><R>{formatINR(rates.reduce((s, r) => s + r.igst, 0))}</R><R>{formatINR(rates.reduce((s, r) => s + r.cgst, 0))}</R><R>{formatINR(rates.reduce((s, r) => s + r.sgst, 0))}</R><R>{formatINR(doc.totalPaise)}</R></tr>
        )))}
      </Table>

      <SectionTitle>GSTR-1: sales to people without a GSTIN (B2C)</SectionTitle>
      <Table head={["Place of supply", "Rate", "Taxable value", "IGST", "CGST", "SGST"]} empty={g1.b2cs.length === 0}>
        {g1.b2cs.map((x) => <tr key={`${x.placeOfSupply}${x.rateBp}${x.interState}`}><L>{STATES[x.placeOfSupply] ?? x.placeOfSupply}</L><L>{rate(x.rateBp)}</L><R>{formatINR(x.taxable)}</R><R>{formatINR(x.igst)}</R><R>{formatINR(x.cgst)}</R><R>{formatINR(x.sgst)}</R></tr>)}
      </Table>
      {g1.b2cl.length > 0 && (
        <>
          <SectionTitle>GSTR-1: large inter-state sales to unregistered buyers (B2CL)</SectionTitle>
          <Table head={["Invoice", "Customer", "Date", "Total"]}>{g1.b2cl.map(({ doc }) => <tr key={doc.number}><L>{doc.number}</L><L>{doc.partyName}</L><R>{doc.date}</R><R>{formatINR(doc.totalPaise)}</R></tr>)}</Table>
        </>
      )}

      <SectionTitle>GSTR-1: return notes (credit notes)</SectionTitle>
      <Table head={["Note", "Customer", "Date", "Taxable value", "Tax", "Total"]} empty={g1.credit.length === 0}>
        {g1.credit.map(({ doc, rates }) => <tr key={doc.number}><L>{doc.number}</L><L>{doc.partyName} {doc.partyGstin ? "" : <Badge tone="neutral">No GSTIN</Badge>}</L><R>{doc.date}</R><R>{formatINR(rates.reduce((s, r) => s + r.taxable, 0))}</R><R>{formatINR(rates.reduce((s, r) => s + r.igst + r.cgst + r.sgst, 0))}</R><R>{formatINR(doc.totalPaise)}</R></tr>)}
      </Table>

      <SectionTitle>GSTR-1: summary by HSN code</SectionTitle>
      <Table head={["HSN / SAC", "Item", "Unit", "Quantity", "Rate", "Taxable value", "Tax"]} empty={g1.hsn.length === 0}>
        {g1.hsn.map((h) => <tr key={`${h.hsn}${h.rateBp}${h.unit}`}><L>{h.hsn || <span className="text-gave">missing</span>}</L><L>{h.description}</L><L>{h.unit}</L><R>{h.qtyMilli / 1000}</R><R>{rate(h.rateBp)}</R><R>{formatINR(h.taxable)}</R><R>{formatINR(h.cgst + h.sgst + h.igst)}</R></tr>)}
      </Table>

      <SectionTitle>GSTR-1: bills issued</SectionTitle>
      <Table head={["Document", "From", "To", "Total", "Cancelled"]} empty={g1.docs.length === 0}>
        {g1.docs.map((d) => <tr key={d.type}><L>{d.type}</L><L>{d.from}</L><L>{d.to}</L><R>{d.total}</R><R>{d.cancelled}</R></tr>)}
      </Table>
    </>
  );
}
