import Link from "next/link";
import { can, requireBusiness } from "@/lib/auth";
import { fieldDay } from "@/lib/field";
import { PageHeader } from "@/components/ui";
import { FieldApp } from "./field-app";

export const metadata = { title: "Salesmen on the road" };

export default async function Field() {
  const ctx = await requireBusiness("ledger:write");
  const data = await fieldDay(ctx);
  return (
    <>
      <PageHeader
        title="Salesmen on the road"
        sub="Check in at customers, take orders and collect money. Works without a signal. It uploads when you are back online."
        action={can(ctx.role, "field:manage") && (
          <div className="flex gap-3 text-sm"><Link href="/field/team" className="text-brand underline">Staff & targets</Link><Link href="/field/beats" className="text-brand underline">Daily routes</Link></div>
        )}
      />
      <FieldApp data={data} businessId={ctx.business.id} userId={ctx.user.id} />
    </>
  );
}
