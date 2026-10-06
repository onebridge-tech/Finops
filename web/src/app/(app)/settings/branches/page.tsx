import { can, requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import { archiveBranch } from "@/app/actions/team";
import { Card, PageHeader } from "@/components/ui";
import { BranchForm } from "./branch-form";

export const metadata = { title: "Branches" };

export default async function Branches() {
  const ctx = await requireBusiness();
  const edit = can(ctx.role, "settings:write");
  const branches = await db.branch.findMany({ where: { businessId: ctx.business.id }, orderBy: [{ archivedAt: "asc" }, { name: "asc" }] });
  const staff = await db.membership.groupBy({ by: ["branchId"], where: { businessId: ctx.business.id, branchId: { not: null } }, _count: true });
  const count = new Map(staff.map((s) => [s.branchId, s._count]));

  return (
    <>
      <PageHeader title="Branches" sub="Shops, godowns or offices. Entries and invoices are tagged with the branch they were made in; staff can be tied to one branch." />
      {edit && <Card className="mb-6"><h2 className="mb-3 font-semibold">Add a branch</h2><BranchForm /></Card>}
      {branches.length === 0 ? (
        <Card className="text-sm text-muted">No branches yet. With one location you don’t need any.</Card>
      ) : (
        <Card className="divide-y divide-line p-0">
          {branches.map((b) => (
            <details key={b.id} className="px-4 py-3">
              <summary className="flex cursor-pointer list-none justify-between gap-2">
                <span className={b.archivedAt ? "text-muted line-through" : "font-medium"}>{b.name}</span>
                <span className="text-xs text-muted">{count.get(b.id) ?? 0} staff tied to it{b.archivedAt && " · archived"}</span>
              </summary>
              {edit && (
                <div className="mt-3 space-y-3 border-t border-line pt-3">
                  {!b.archivedAt && <BranchForm branch={{ id: b.id, name: b.name, address: b.address ?? "", phone: b.phone ?? "", gstin: b.gstin ?? "", invoicePrefix: b.invoicePrefix ?? "" }} />}
                  <form action={archiveBranch}>
                    <input type="hidden" name="branchId" value={b.id} />
                    <button className="text-xs text-muted underline hover:text-ink">{b.archivedAt ? "Restore branch" : "Archive branch"}</button>
                  </form>
                </div>
              )}
            </details>
          ))}
        </Card>
      )}
    </>
  );
}
