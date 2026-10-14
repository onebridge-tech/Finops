import { requireBusiness, ROLE_LABEL, type Role } from "@/lib/auth";
import { db } from "@/lib/db";
import { removeMember } from "@/app/actions/team";
import { Card, PageHeader, fmtDate } from "@/components/ui";
import { InviteForm, MemberForm } from "./forms";

export const metadata = { title: "Your staff" };

export default async function Team() {
  const ctx = await requireBusiness("team:manage");
  const [members, branches, sessions] = await Promise.all([
    db.membership.findMany({ where: { businessId: ctx.business.id }, include: { user: true }, orderBy: { createdAt: "asc" } }),
    db.branch.findMany({ where: { businessId: ctx.business.id, archivedAt: null }, orderBy: { name: "asc" } }),
    db.session.groupBy({ by: ["userId"], where: { businessId: ctx.business.id }, _max: { lastActiveAt: true } }),
  ]);
  const lastSeen = new Map(sessions.map((s) => [s.userId, s._max.lastActiveAt]));
  const branchName = new Map(branches.map((b) => [b.id, b.name]));
  const branchOpts = branches.map((b) => ({ id: b.id, name: b.name }));

  return (
    <>
      <PageHeader title="Your staff" sub="Who can use your shop’s account, what they can do and what they can see." />
      <Card className="mb-6">
        <h2 className="mb-3 font-semibold">Add a staff member</h2>
        <InviteForm branches={branchOpts} canAddOwner={ctx.role === "OWNER"} />
      </Card>
      <Card className="divide-y divide-line p-0">
        {members.map((m) => {
          const r = ROLE_LABEL[m.role as Role];
          return (
            <details key={m.id} className="group px-4 py-3">
              <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2">
                <span>
                  <span className="font-medium">{m.user.name ?? `+${m.user.phone}`}</span>
                  {m.userId === ctx.user.id && <span className="ml-2 text-xs text-muted">(you)</span>}
                  <span className="block text-xs text-muted">
                    +{m.user.phone} · {r?.name ?? m.role}
                    {m.branchId && ` · ${branchName.get(m.branchId) ?? "branch"} only`}
                    {m.partyScope === "ASSIGNED" && " · assigned parties only"}
                    {m.maxDiscountBp !== null && ` · discount up to ${m.maxDiscountBp / 100}%`}
                  </span>
                </span>
                <span className="text-xs text-muted">{lastSeen.get(m.userId) ? `active ${fmtDate(lastSeen.get(m.userId))}` : "not signed in yet"}</span>
              </summary>
              {m.userId !== ctx.user.id && (m.role !== "OWNER" || ctx.role === "OWNER") && (
                <div className="mt-3 space-y-3 border-t border-line pt-3">
                  <MemberForm
                    branches={branchOpts}
                    canAddOwner={ctx.role === "OWNER"}
                    member={{ id: m.id, role: m.role, branchId: m.branchId ?? "", partyScope: m.partyScope, maxDiscount: m.maxDiscountBp === null ? "" : String(m.maxDiscountBp / 100) }}
                  />
                  <form action={removeMember}>
                    <input type="hidden" name="membershipId" value={m.id} />
                    <button className="text-xs text-muted underline hover:text-gave">Remove from staff and sign out their phones</button>
                  </form>
                </div>
              )}
            </details>
          );
        })}
      </Card>
      <p className="mt-3 text-xs text-muted">Everything a staff member writes belongs to your shop and stays when they leave.</p>
    </>
  );
}
