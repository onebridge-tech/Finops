import Link from "next/link";
import { partyWhere, requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatINR } from "@/lib/money";
import { Card, EmptyState, LinkButton, PageHeader, fmtDate } from "@/components/ui";

export const metadata = { title: "Returns & corrections" };

export default async function Notes() {
  const ctx = await requireBusiness();
  const parties = await db.party.findMany({ where: partyWhere(ctx), select: { id: true, name: true } });
  const pn = new Map(parties.map((p) => [p.id, p.name]));
  const notes = await db.note.findMany({
    where: { businessId: ctx.business.id, ...(ctx.branchId ? { branchId: ctx.branchId } : {}), partyId: { in: [...pn.keys()] } },
    orderBy: { createdAt: "desc" }, take: 100,
  });
  return (
    <>
      <PageHeader
        title="Returns & corrections"
        sub="A return note lowers what a customer owes (goods sent back, a discount). An extra charge note adds to it."
        action={<div className="flex gap-2"><LinkButton href="/notes/new?kind=DEBIT" variant="secondary">Extra charge note</LinkButton><LinkButton href="/notes/new">Return note</LinkButton></div>}
      />
      {notes.length === 0 ? <EmptyState title="No returns yet">When goods come back, open the bill and tap “Return note”.</EmptyState> : (
        <Card className="divide-y divide-line p-0 text-base">
          {notes.map((n) => (
            <Link key={n.id} href={`/notes/${n.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-bg">
              <span>
                <span className="block font-medium">{n.number} · {pn.get(n.partyId) ?? "—"}</span>
                <span className="text-sm text-muted">{fmtDate(n.date)} · {n.kind === "CREDIT" ? "credit note" : "debit note"} · {n.reason}</span>
              </span>
              <span className={`font-semibold tabular-nums ${n.kind === "CREDIT" ? "text-got" : "text-gave"}`}>{n.kind === "CREDIT" ? "−" : "+"}{formatINR(n.totalPaise)}</span>
            </Link>
          ))}
        </Card>
      )}
    </>
  );
}
