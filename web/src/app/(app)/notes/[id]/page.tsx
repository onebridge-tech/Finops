import Link from "next/link";
import { notFound } from "next/navigation";
import { findParty, requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import { DocumentView } from "@/components/document-view";
import { PrintButton } from "@/components/print-button";
import { PageHeader } from "@/components/ui";

export default async function NotePage({ params }: PageProps<"/notes/[id]">) {
  const { id } = await params;
  const ctx = await requireBusiness();
  const note = await db.note.findFirst({ where: { id, businessId: ctx.business.id, ...(ctx.branchId ? { branchId: ctx.branchId } : {}) }, include: { lines: true } });
  if (!note) notFound();
  const party = await findParty(ctx, note.partyId);
  if (!party) notFound();
  const invoice = note.invoiceId ? await db.invoice.findUnique({ where: { id: note.invoiceId }, select: { id: true, number: true } }) : null;
  const credit = note.kind === "CREDIT";
  return (
    <>
      <div className="no-print">
        <PageHeader
          title={note.number}
          sub={<><Link href={`/parties/${party.id}`} className="hover:underline">{party.name}</Link>{invoice && <> · against <Link href={`/invoices/${invoice.id}`} className="hover:underline">{invoice.number}</Link></>}</>}
          action={<PrintButton />}
        />
      </div>
      <DocumentView
        doc={{ ...note, kind: credit ? "CREDIT_NOTE" : "DEBIT_NOTE", dueDate: null, notes: `${invoice ? `Against invoice ${invoice.number}. ` : ""}Reason: ${note.reason}` }}
        business={ctx.business}
        party={party}
      />
    </>
  );
}
