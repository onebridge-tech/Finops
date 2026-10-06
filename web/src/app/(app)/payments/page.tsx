import Link from "next/link";
import { requireBusiness, partyWhere } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatINR } from "@/lib/money";
import { fmtDate } from "@/lib/format";
import { gatewayMode } from "@/lib/payments/gateway";
import { Card, PageHeader } from "@/components/ui";

export const metadata = { title: "Online payments" };

export default async function Payments() {
  const ctx = await requireBusiness("reports:view");
  const parties = await db.party.findMany({ where: partyWhere(ctx), select: { id: true, name: true } });
  const names = new Map(parties.map((p) => [p.id, p.name]));
  const rows = await db.payment.findMany({ where: { businessId: ctx.business.id, partyId: { in: [...names.keys()] } }, orderBy: { createdAt: "desc" }, take: 100 });
  const invoices = await db.invoice.findMany({ where: { id: { in: rows.flatMap((r) => (r.invoiceId ? [r.invoiceId] : [])) } }, select: { id: true, number: true } });
  const inv = new Map(invoices.map((i) => [i.id, i.number]));
  const paid = rows.filter((r) => r.status === "PAID");
  const mode = gatewayMode();
  return (
    <>
      <PageHeader title="Online payments" sub={mode === "test" ? "Test mode: customers see a fake pay button and no money moves." : mode ? `Live through ${mode}.` : "Online payment is switched off (no gateway keys set)."} />
      <Card className="mb-4 text-sm">Received online: <span className="font-semibold text-got">{formatINR(paid.reduce((s, r) => s + Number(r.amountPaise), 0))}</span> in {paid.length} payment{paid.length === 1 ? "" : "s"}. Each one is already in the customer’s ledger with a receipt, and the invoice is marked paid.</Card>
      <Card className="overflow-x-auto p-0 text-sm">
        <table className="w-full">
          <thead className="text-left text-xs uppercase text-muted"><tr><th className="px-4 py-2">Date</th><th>Customer</th><th>For</th><th className="text-right">Amount</th><th>Status</th><th className="px-4">Gateway ref</th></tr></thead>
          <tbody className="divide-y divide-line">
            {rows.length === 0 && <tr><td colSpan={6} className="px-4 py-3 text-muted">No online payments yet. Customers see “Pay online” on invoice and statement links.</td></tr>}
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-2">{fmtDate(r.paidAt ?? r.createdAt)}</td>
                <td><Link className="underline" href={`/parties/${r.partyId}`}>{names.get(r.partyId)}</Link></td>
                <td>{r.invoiceId ? (inv.get(r.invoiceId) ?? "Invoice") : "Balance"}</td>
                <td className="text-right tabular-nums">{formatINR(Number(r.amountPaise))}</td>
                <td className={r.status === "PAID" ? "text-got" : r.status === "FAILED" ? "text-gave" : "text-muted"}>{r.status === "CREATED" ? "Waiting" : r.status === "PAID" ? "Paid" : "Not completed"}{r.provider === "test" && " (test)"}</td>
                <td className="px-4 text-xs text-muted">{r.providerPaymentId ?? r.providerOrderId}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}
