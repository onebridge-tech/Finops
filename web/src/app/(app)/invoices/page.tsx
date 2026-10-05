import Link from "next/link";
import { requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatINR } from "@/lib/money";
import { Card, EmptyState, LinkButton, PageHeader, fmtDate } from "@/components/ui";

export const metadata = { title: "Invoices" };

export default async function Invoices() {
  const { business } = await requireBusiness();
  const invoices = await db.invoice.findMany({
    where: { businessId: business.id },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { party: { select: { name: true } } },
  });
  return (
    <>
      <PageHeader title="Invoices" action={<LinkButton href="/invoices/new">New invoice</LinkButton>} />
      {invoices.length === 0 ? (
        <EmptyState title="No invoices yet">Create a GST invoice and share it on WhatsApp with a pay link.</EmptyState>
      ) : (
        <Card className="divide-y divide-line p-0 text-sm">
          {invoices.map((i) => (
            <Link key={i.id} href={`/invoices/${i.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-bg">
              <span>
                <span className="block font-medium">{i.number} · {i.party.name}</span>
                <span className="text-xs text-muted">{fmtDate(i.date)}{i.dueDate ? ` · due ${fmtDate(i.dueDate)}` : ""}</span>
              </span>
              <span className="font-semibold tabular-nums">{formatINR(i.totalPaise)}</span>
            </Link>
          ))}
        </Card>
      )}
    </>
  );
}
