import { requireBusiness } from "@/lib/auth";
import { NewDocument } from "@/components/new-document";

export const metadata = { title: "New quotation" };

export default async function NewQuote({ searchParams }: PageProps<"/quotes/new">) {
  const ctx = await requireBusiness("invoice:write");
  return <NewDocument kind="QUOTE" ctx={ctx} preselect={String((await searchParams).party ?? "")} />;
}
