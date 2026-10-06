import Link from "next/link";
import { can, requireBusiness } from "@/lib/auth";
import { fieldDay } from "@/lib/field";
import { PageHeader } from "@/components/ui";
import { FieldApp } from "./field-app";

export const metadata = { title: "Field sales" };

export default async function Field() {
  const ctx = await requireBusiness("ledger:write");
  const data = await fieldDay(ctx);
  return (
    <>
      <PageHeader
        title="Field sales"
        sub="Check in at customers, take orders, collect payments. Works without a signal — it uploads when you’re back online."
        action={can(ctx.role, "field:manage") && (
          <div className="flex gap-3 text-sm"><Link href="/field/team" className="text-brand underline">Team & targets</Link><Link href="/field/beats" className="text-brand underline">Beats</Link></div>
        )}
      />
      <FieldApp data={data} businessId={ctx.business.id} userId={ctx.user.id} />
    </>
  );
}
