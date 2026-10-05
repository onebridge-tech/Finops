import { requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import { EmptyState, LinkButton, PageHeader, todayIST } from "@/components/ui";
import { InvoiceForm } from "./invoice-form";

export const metadata = { title: "New invoice" };

export default async function NewInvoice({ searchParams }: PageProps<"/invoices/new">) {
  const { business } = await requireBusiness("invoice:write");
  const preselect = String((await searchParams).party ?? "");
  const [parties, items] = await Promise.all([
    db.party.findMany({ where: { businessId: business.id, archivedAt: null, type: { in: ["CUSTOMER", "BOTH"] } }, orderBy: { name: "asc" } }),
    db.item.findMany({ where: { businessId: business.id, archivedAt: null }, orderBy: { name: "asc" } }),
  ]);
  if (parties.length === 0) {
    return (
      <EmptyState title="Add a customer first">
        <LinkButton href="/parties/new" className="mt-3">Add party</LinkButton>
      </EmptyState>
    );
  }
  return (
    <>
      <PageHeader title="New invoice" sub={`Next number: ${business.invoicePrefix}${business.nextInvoiceNo}`} />
      <InvoiceForm
        businessState={business.stateCode}
        today={todayIST()}
        preselect={preselect}
        parties={parties.map((p) => ({ id: p.id, name: p.name, stateCode: p.stateCode ?? business.stateCode, creditDays: p.creditDays }))}
        items={items.map((i) => ({ id: i.id, name: i.name, hsn: i.hsn ?? "", unit: i.unit, ratePaise: Number(i.pricePaise), taxRateBp: i.taxRateBp }))}
      />
    </>
  );
}
