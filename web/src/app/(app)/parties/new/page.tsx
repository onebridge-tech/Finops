import { requireBusiness } from "@/lib/auth";
import { Card, PageHeader } from "@/components/ui";
import { PartyForm } from "./party-form";

export const metadata = { title: "Add party" };

export default async function NewParty() {
  const { business } = await requireBusiness("party:write");
  return (
    <>
      <PageHeader title="Add party" sub="A customer, a supplier, or both." />
      <Card className="max-w-2xl"><PartyForm defaultState={business.stateCode} /></Card>
    </>
  );
}
