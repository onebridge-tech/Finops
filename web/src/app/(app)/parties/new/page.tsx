import { requireBusiness } from "@/lib/auth";
import { partyFormOptions } from "@/lib/team";
import { Card, PageHeader } from "@/components/ui";
import { PartyForm } from "./party-form";

export const metadata = { title: "Add customer" };

export default async function NewParty() {
  const ctx = await requireBusiness("party:write");
  const opts = await partyFormOptions(ctx);
  return (
    <>
      <PageHeader title="Add customer" sub="A customer, a supplier, a possible customer, or both." />
      <Card className="max-w-2xl"><PartyForm defaultState={ctx.business.stateCode} defaultBranch={ctx.branchId ?? ""} {...opts} /></Card>
    </>
  );
}
