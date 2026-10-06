import { notFound } from "next/navigation";
import { docWhere, requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import { NewDocument } from "@/components/new-document";
import { CreditNoteForm } from "./credit-note-form";
import { Card, EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { formatINR } from "@/lib/money";

export const metadata = { title: "New note" };

// ?kind=DEBIT → free-line debit note. Otherwise a credit note raised against an invoice (?invoice=<id>).
export default async function NewNote({ searchParams }: PageProps<"/notes/new">) {
  const sp = await searchParams;
  const ctx = await requireBusiness("invoice:write");
  if (sp.kind === "DEBIT") return <NewDocument kind="DEBIT_NOTE" ctx={ctx} preselect={String(sp.party ?? "")} />;

  const invoiceId = String(sp.invoice ?? "");
  if (!invoiceId) {
    const recent = await db.invoice.findMany({ where: { ...docWhere(ctx), status: "ISSUED" }, orderBy: { createdAt: "desc" }, take: 30, include: { party: { select: { name: true } } } });
    return (
      <>
        <PageHeader title="New credit note" sub="Choose the invoice the return or discount is against." />
        {recent.length === 0 ? <EmptyState title="No invoices yet" /> : (
          <Card className="divide-y divide-line p-0 text-sm">
            {recent.map((i) => <a key={i.id} href={`/notes/new?invoice=${i.id}`} className="flex justify-between px-4 py-3 hover:bg-bg"><span>{i.number} · {i.party.name}</span><span className="tabular-nums">{formatINR(i.totalPaise)}</span></a>)}
          </Card>
        )}
        <LinkButton href="/notes/new?kind=DEBIT" variant="secondary" className="mt-4">New debit note instead</LinkButton>
      </>
    );
  }
  const invoice = await db.invoice.findFirst({ where: { ...docWhere(ctx), id: invoiceId, status: "ISSUED" }, include: { lines: true, party: { select: { name: true } } } });
  if (!invoice) notFound();
  const prior = await db.noteLine.findMany({ where: { note: { invoiceId: invoice.id, kind: "CREDIT", status: "ISSUED" } } });
  const done = new Map<string, number>();
  for (const p of prior) done.set(p.itemId ?? `d:${p.description}`, (done.get(p.itemId ?? `d:${p.description}`) ?? 0) + p.qtyMilli);
  return (
    <>
      <PageHeader title="New credit note" sub={`Against ${invoice.number} · ${invoice.party.name}`} />
      <CreditNoteForm
        invoiceId={invoice.id}
        lines={invoice.lines.map((l) => ({
          id: l.id, description: l.description, unit: l.unit, rate: formatINR(l.ratePaise), taxPct: l.taxRateBp / 100,
          maxMilli: l.qtyMilli - (done.get(l.itemId ?? `d:${l.description}`) ?? 0), tracked: !!l.itemId,
        }))}
      />
    </>
  );
}
