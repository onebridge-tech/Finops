import Link from "next/link";
import { docWhere, requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatINR } from "@/lib/money";
import { Card, EmptyState, LinkButton, PageHeader, fmtDate } from "@/components/ui";

export const metadata = { title: "Invoices" };

export default async function Invoices() {
  const ctx = await requireBusiness();
  const invoices = await db.invoice.findMany({
    where: docWhere(ctx),
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { party: { select: { name: true } } },
  });
  return (
    <>
      <PageHeader
        title="Invoices"
        action={
          <div className="flex gap-2">
            <LinkButton href="/quotes" variant="secondary">Quotations</LinkButton>
            <LinkButton href="/invoices/new">New invoice</LinkButton>
          </div>
        }
      />
      {invoices.length === 0 ? (
        <EmptyState title="No invoices yet">Create a GST invoice and share it on WhatsApp with a pay link.</EmptyState>
      ) : (
        <Card className="divide-y divide-line p-0 text-sm">
          {invoices.map((i) => (
            <Link key={i.id} href={`/invoices/${i.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-bg">
              <span>
                <span className="block font-medium">{i.number} · {i.party.name}</span>
                <span className="text-xs text-muted">
                  {fmtDate(i.date)}{i.dueDate ? ` · due ${fmtDate(i.dueDate)}` : ""}
                  {i.status === "CANCELLED" ? " · cancelled" : i.viewCount > 0 ? ` · viewed ${i.viewCount}×` : ""}
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
