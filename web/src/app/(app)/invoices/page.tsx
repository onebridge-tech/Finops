import Link from "next/link";
import { docWhere, requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatINR } from "@/lib/money";
import { Card, EmptyState, LinkButton, PageHeader, fmtDate } from "@/components/ui";
import { invoicePayments } from "@/lib/queries";

export const metadata = { title: "Bills" };

export default async function Invoices() {
  const ctx = await requireBusiness();
  const invoices = await db.invoice.findMany({
    where: docWhere(ctx),
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { party: { select: { name: true, gstin: true } } },
  });
  const pay = await invoicePayments(ctx.business.id, invoices);
  return (
    <>
      <PageHeader
        title="Bills"
        action={
          <div className="flex gap-2">
            <LinkButton href="/quotes" variant="secondary">Price quotes</LinkButton>
            <LinkButton href="/invoices/new">Make a bill</LinkButton>
          </div>
        }
      />
      {invoices.length === 0 ? (
        <EmptyState title="No bills yet">Make a GST bill and send it on WhatsApp with a link to pay.</EmptyState>
      ) : ctx.user.uiMode === "ACCOUNTANT" ? (
        <GstRegister invoices={invoices} />
      ) : (
        <Card className="divide-y divide-line p-0 text-base">
          {invoices.map((i) => (
            <Link key={i.id} href={`/invoices/${i.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-bg">
              <span>
                <span className="block font-medium">{i.number} · {i.party.name}</span>
                <span className="text-sm text-muted">
                  {fmtDate(i.date)}{i.dueDate ? ` · due ${fmtDate(i.dueDate)}` : ""}
                  {i.status === "CANCELLED" ? " · cancelled" : i.viewCount > 0 ? ` · viewed ${i.viewCount}×` : ""}
                  {pay.get(i.id) && pay.get(i.id)!.status !== "CANCELLED" && (
                    <> · <span className={pay.get(i.id)!.status === "PAID" ? "text-got" : pay.get(i.id)!.status === "PART" ? "text-gave" : ""}>{pay.get(i.id)!.status === "PAID" ? "Paid" : pay.get(i.id)!.status === "PART" ? `${formatINR(pay.get(i.id)!.open)} due` : "Unpaid"}</span></>
                  )}
                </span>
              </span>
              <span className={`font-semibold tabular-nums ${i.status === "CANCELLED" ? "text-muted line-through" : ""}`}>{formatINR(i.totalPaise)}</span>
            </Link>
          ))}
        </Card>
      )}
    </>
  );
}

type Row = { id: string; number: string; date: Date; status: string; placeOfSupply: string; taxablePaise: bigint; cgstPaise: bigint; sgstPaise: bigint; igstPaise: bigint; totalPaise: bigint; party: { name: string; gstin?: string | null } };

/** Accountant view (LO-02): sales register with the GST split; cancelled invoices are excluded from totals. */
function GstRegister({ invoices }: { invoices: Row[] }) {
  const live = invoices.filter((i) => i.status !== "CANCELLED");
  const sum = (k: "taxablePaise" | "cgstPaise" | "sgstPaise" | "igstPaise" | "totalPaise") => live.reduce((s, i) => s + i[k], 0n);
  const td = "px-3 py-2 text-right tabular-nums";
  return (
    <Card className="overflow-x-auto p-0">
      <table className="w-full min-w-[820px] text-base">
        <thead className="border-b border-line text-left text-sm uppercase text-muted">
          <tr>
            <th className="px-3 py-2">Date</th><th className="px-3 py-2">Voucher no.</th><th className="px-3 py-2">Party</th><th className="px-3 py-2">GSTIN</th><th className="px-3 py-2">POS</th>
            <th className={td}>Before GST</th><th className={td}>CGST</th><th className={td}>SGST</th><th className={td}>IGST</th><th className={td}>Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {invoices.map((i) => (
            <tr key={i.id} className={i.status === "CANCELLED" ? "text-muted line-through" : ""}>
              <td className="whitespace-nowrap px-3 py-2">{fmtDate(i.date)}</td>
              <td className="px-3 py-2"><Link href={`/invoices/${i.id}`} className="underline">{i.number}</Link></td>
              <td className="px-3 py-2">{i.party.name}</td>
              <td className="px-3 py-2 font-mono text-sm">{i.party.gstin ?? "—"}</td>
              <td className="px-3 py-2">{i.placeOfSupply}</td>
              <td className={td}>{formatINR(i.taxablePaise)}</td><td className={td}>{formatINR(i.cgstPaise)}</td>
              <td className={td}>{formatINR(i.sgstPaise)}</td><td className={td}>{formatINR(i.igstPaise)}</td><td className={td}>{formatINR(i.totalPaise)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot className="border-t border-line font-semibold">
          <tr>
            <td className="px-3 py-2" colSpan={5}>Total ({live.length} invoices)</td>
            <td className={td}>{formatINR(sum("taxablePaise"))}</td><td className={td}>{formatINR(sum("cgstPaise"))}</td>
            <td className={td}>{formatINR(sum("sgstPaise"))}</td><td className={td}>{formatINR(sum("igstPaise"))}</td><td className={td}>{formatINR(sum("totalPaise"))}</td>
          </tr>
        </tfoot>
      </table>
    </Card>
  );
}
