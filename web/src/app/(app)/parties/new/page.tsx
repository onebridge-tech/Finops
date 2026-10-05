import { requireBusiness } from "@/lib/auth";
import { partyFormOptions } from "@/lib/team";
import { Card, PageHeader } from "@/components/ui";
import { PartyForm } from "./party-form";

export const metadata = { title: "Add party" };

export default async function NewParty() {
  const ctx = await requireBusiness("party:write");
  const opts = await partyFormOptions(ctx);
  return (
    <>
      <PageHeader title="Add party" sub="A customer, a supplier, a lead, or both." />
      <Card className="max-w-2xl"><PartyForm defaultState={ctx.business.stateCode} defaultBranch={ctx.branchId ?? ""} {...opts} /></Card>
    </>
  );
}
