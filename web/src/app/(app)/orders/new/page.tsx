import { requireBusiness } from "@/lib/auth";
import { NewDocument } from "@/components/new-document";

export const metadata = { title: "New order" };

export default async function NewOrder({ searchParams }: PageProps<"/orders/new">) {
  const sp = await searchParams;
  const ctx = await requireBusiness("invoice:write");
  return <NewDocument kind={sp.kind === "PURCHASE" ? "PURCHASE_ORDER" : "SALES_ORDER"} ctx={ctx} preselect={String(sp.party ?? "")} />;
}
