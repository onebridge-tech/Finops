import type { Business } from "@prisma/client";
import { db } from "@/lib/db";
import { EmptyState, LinkButton, PageHeader, todayIST } from "./ui";
import { DocumentForm } from "./document-form";

/** "New invoice" and "New quotation" pages share this loader and form. */
export async function NewDocument({ kind, business, preselect }: { kind: "INVOICE" | "QUOTE"; business: Business; preselect: string }) {
  const [parties, items] = await Promise.all([
    db.party.findMany({ where: { businessId: business.id, archivedAt: null, type: { in: ["CUSTOMER", "BOTH", "LEAD"] } }, orderBy: { name: "asc" } }),
    db.item.findMany({ where: { businessId: business.id, archivedAt: null }, orderBy: [{ name: "asc" }, { variantName: "asc" }] }),
  ]);
  if (parties.length === 0) {
    return (
      <EmptyState title="Add a customer first">
        <LinkButton href="/parties/new" className="mt-3">Add party</LinkButton>
      </EmptyState>
    );
  }
  const isQuote = kind === "QUOTE";
  return (
    <>
      <PageHeader
        title={isQuote ? "New quotation" : "New invoice"}
        sub={`Next number: ${isQuote ? `${business.quotePrefix}${business.nextQuoteNo}` : `${business.invoicePrefix}${business.nextInvoiceNo}`}`}
      />
      <DocumentForm
        kind={kind}
        businessState={business.stateCode}
        today={todayIST()}
        preselect={preselect}
        parties={parties.map((p) => ({ id: p.id, name: p.name, stateCode: p.stateCode ?? business.stateCode, creditDays: p.creditDays }))}
        items={items.map((i) => ({
          id: i.id, name: i.variantName ? `${i.name} — ${i.variantName}` : i.name, hsn: i.hsn ?? "", unit: i.unit,
          ratePaise: Number(i.pricePaise), taxRateBp: i.taxRateBp,
        }))}
      />
    </>
  );
}
