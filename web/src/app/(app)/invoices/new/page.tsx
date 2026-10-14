import { requireBusiness } from "@/lib/auth";
import { NewDocument } from "@/components/new-document";

export const metadata = { title: "Make a bill" };

export default async function NewInvoice({ searchParams }: PageProps<"/invoices/new">) {
  const ctx = await requireBusiness("invoice:write");
  return <NewDocument kind="INVOICE" ctx={ctx} preselect={String((await searchParams).party ?? "")} />;
}
