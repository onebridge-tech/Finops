import Link from "next/link";
import { notFound } from "next/navigation";
import { branchOrShared, can, findParty, requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatINR } from "@/lib/money";
import { pendingMilli } from "@/lib/rules";
import { setOrderStatus } from "@/app/actions/orders";
import { DocumentView } from "@/components/document-view";
import { PrintButton } from "@/components/print-button";
import { Card, PageHeader, buttonClass, fmtDate } from "@/components/ui";
import { FulfilForm } from "./fulfil-form";

export default async function OrderPage({ params }: PageProps<"/orders/[id]">) {
  const { id } = await params;
  const ctx = await requireBusiness();
  const order = await db.order.findFirst({ where: { id, businessId: ctx.business.id, ...branchOrShared(ctx) }, include: { lines: true } });
  if (!order) notFound();
  const party = await findParty(ctx, order.partyId);
  if (!party) notFound();
  const invoices = await db.invoice.findMany({ where: { orderId: order.id }, orderBy: { createdAt: "asc" } });
  const quote = order.quoteId ? await db.quote.findUnique({ where: { id: order.quoteId }, select: { id: true, number: true } }) : null;
  const write = can(ctx.role, "invoice:write");
  const sales = order.kind === "SALES";
  const open = ["OPEN", "PARTIAL"].includes(order.status);
  const statusForm = (status: string, label: string, variant: "primary" | "secondary") => (
    <form action={setOrderStatus}>
      <input type="hidden" name="orderId" value={order.id} />
      <input type="hidden" name="status" value={status} />
      <button className={buttonClass(variant)}>{label}</button>
    </form>
  );

  return (
    <>
      <div className="no-print">
        <PageHeader
          title={order.number}
          sub={<><Link href={`/parties/${party.id}`} className="hover:underline">{party.name}</Link> · {sales ? "sales order" : "purchase order"} · {order.status.toLowerCase()}{quote && <> · from <Link href={`/quotes/${quote.id}`} className="hover:underline">{quote.number}</Link></>}</>}
          action={
            <div className="flex gap-2">
              <PrintButton />
              {write && order.status === "REQUEST" && (<>{statusForm("OPEN", "Accept request", "primary")}{statusForm("CANCELLED", "Decline", "secondary")}</>)}
            </div>
          }
        />
        {order.status === "REQUEST" && (
          <Card className="mb-4 border-brand/40 bg-brand/5 text-sm">
            This order was placed from your catalogue and is waiting for you to accept it. {party.type === "LEAD" && "The buyer is saved as a lead."}
          </Card>
        )}

        {open && (
          <Card className="mb-4 space-y-3">
            <h2 className="font-semibold">{sales ? "Deliver" : "Receive goods"}</h2>
            <p className="text-xs text-muted">
              {sales ? "Enter what you are delivering now. An invoice is created for those quantities; the rest stays pending." : "Enter what arrived. Stock goes up and the supplier’s account is credited for that value."}
            </p>
            {write || can(ctx.role, "stock:write") ? (
              <FulfilForm
                kind={order.kind as "SALES" | "PURCHASE"}
                orderId={order.id}
                lines={order.lines.map((l) => ({ id: l.id, description: l.description, unit: l.unit, ordered: l.qtyMilli / 1000, done: l.fulfilledMilli / 1000, pending: pendingMilli(l) / 1000 }))}
              />
            ) : <p className="text-sm text-muted">You can view this order but not fulfil it.</p>}
            {write && (
              <form action={setOrderStatus} className="border-t border-line pt-3">
                <input type="hidden" name="orderId" value={order.id} />
                <input type="hidden" name="status" value="CANCELLED" />
                <button className="text-xs text-muted underline hover:text-gave">Cancel the rest of this order</button>
              </form>
            )}
          </Card>
        )}
        {invoices.length > 0 && (
          <Card className="mb-4 text-sm">
            <p className="mb-1 font-semibold">Bills made from this order</p>
            {invoices.map((i) => <Link key={i.id} href={`/invoices/${i.id}`} className="mr-4 underline">{i.number} · {fmtDate(i.date)} · {formatINR(i.totalPaise)}</Link>)}
          </Card>
        )}
      </div>
      <DocumentView doc={{ ...order, kind: sales ? "SALES_ORDER" : "PURCHASE_ORDER", dueDate: order.expectedDate, lines: order.lines }} business={ctx.business} party={party} />
    </>
  );
}
