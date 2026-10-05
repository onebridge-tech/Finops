import { notFound } from "next/navigation";
import { findParty, requireBusiness } from "@/lib/auth";
import { partyFormOptions } from "@/lib/team";
import { archiveParty } from "@/app/actions/ledger";
import { Card, PageHeader } from "@/components/ui";
import { PartyForm } from "../../new/party-form";

export const metadata = { title: "Edit party" };

export default async function EditParty({ params }: PageProps<"/parties/[id]/edit">) {
  const { id } = await params;
  const ctx = await requireBusiness("party:write");
  const party = await findParty(ctx, id);
  if (!party) notFound();
  const opts = await partyFormOptions(ctx);
  return (
    <>
      <PageHeader title={`Edit ${party.name}`} />
      <Card className="max-w-2xl">
        <PartyForm
          defaultState={ctx.business.stateCode}
          {...opts}
          party={{
            id: party.id, name: party.name, type: party.type, phone: party.phone ?? "", email: party.email ?? "", gstin: party.gstin ?? "",
            stateCode: party.stateCode ?? "", address: party.address ?? "", creditDays: party.creditDays?.toString() ?? "",
            language: party.language, source: party.source ?? "", ownerId: party.ownerId ?? "", branchId: party.branchId ?? "",
          }}
        />
      </Card>
      <form action={archiveParty} className="mt-4">
        <input type="hidden" name="partyId" value={party.id} />
        <input type="hidden" name="archive" value={party.archivedAt ? "0" : "1"} />
        <button className="text-sm text-muted underline hover:text-gave">
          {party.archivedAt ? "Restore this party" : "Archive this party (hides it from lists and stops reminders; the ledger is kept)"}
        </button>
      </form>
    </>
  );
}
