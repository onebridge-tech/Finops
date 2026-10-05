import Link from "next/link";
import { requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import { logout } from "@/app/actions/auth";
import { NavLinks } from "./nav-links";
import { BranchSwitcher, BusinessSwitcher, IdleLock, LockButton } from "./header-controls";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const { business, user, role, membership, branchId } = await requireBusiness();
  const [memberships, branches] = await Promise.all([
    db.membership.findMany({ where: { userId: user.id }, include: { business: { select: { id: true, name: true } } }, orderBy: { createdAt: "asc" } }),
    db.branch.findMany({ where: { businessId: business.id, archivedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const tiedBranch = membership.branchId ? branches.find((b) => b.id === membership.branchId) : null;

  return (
    <div className="min-h-screen pb-20 md:pb-0">
      {user.pinHash && <IdleLock minutes={user.lockAfterMin} />}
      <header className="no-print border-b border-line bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <BusinessSwitcher current={business.id} businesses={memberships.map((m) => m.business)} />
            {tiedBranch ? (
              <span className="rounded-lg border border-line px-2 py-1 text-sm text-muted">{tiedBranch.name}</span>
            ) : (
              branches.length > 0 && <BranchSwitcher current={branchId ?? ""} branches={branches} />
            )}
          </div>
          <nav className="hidden md:block"><NavLinks /></nav>
          <div className="flex items-center gap-2 text-sm text-muted">
            <Link href="/settings/security" className="hidden hover:text-ink sm:inline">{user.name ?? `+${user.phone}`} · {role.toLowerCase()}</Link>
            {user.pinHash && <LockButton />}
            <form action={logout}><button className="hover:text-ink">Sign out</button></form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      <nav className="no-print fixed inset-x-0 bottom-0 border-t border-line bg-card md:hidden"><NavLinks mobile /></nav>
    </div>
  );
}
