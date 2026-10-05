import Link from "next/link";
import { requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatINR } from "@/lib/money";
import { Card, EmptyState, LinkButton, PageHeader, fmtDate } from "@/components/ui";
import { quoteStatus } from "./status";

export const metadata = { title: "Quotations" };

export default async function Quotes() {
  const { business } = await requireBusiness();
  const quotes = await db.quote.findMany({
    where: { businessId: business.id },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { party: { select: { name: true } } },
  });
  return (
    <>
      <PageHeader title="Quotations" sub="Send a price, get it accepted, turn it into an invoice in one tap." action={<LinkButton href="/quotes/new">New quotation</LinkButton>} />
      {quotes.length === 0 ? (
        <EmptyState title="No quotations yet" />
      ) : (
        <Card className="divide-y divide-line p-0 text-sm">
          {quotes.map((q) => {
            const s = quoteStatus(q);
            return (
              <Link key={q.id} href={`/quotes/${q.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-bg">
                <span>
                  <span className="block font-medium">{q.number} · {q.party.name}</span>
                  <span className="text-xs text-muted">{fmtDate(q.date)} · <span className={s.tone}>{s.label}</span></span>
                </span>
                <span className="font-semibold tabular-nums">{formatINR(q.totalPaise)}</span>
              </Link>
            );
          })}
        </Card>
      )}
    </>
  );
}
