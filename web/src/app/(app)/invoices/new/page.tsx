import { requireBusiness } from "@/lib/auth";
import { NewDocument } from "@/components/new-document";

export const metadata = { title: "New invoice" };

export default async function NewInvoice({ searchParams }: PageProps<"/invoices/new">) {
  const { business } = await requireBusiness("invoice:write");
  return <NewDocument kind="INVOICE" business={business} preselect={String((await searchParams).party ?? "")} />;
}
