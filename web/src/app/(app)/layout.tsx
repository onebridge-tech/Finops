import Link from "next/link";
import { partyWhere, requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import { translator } from "@/lib/i18n";
import { logout } from "@/app/actions/auth";
import { I18nProvider } from "@/components/i18n-provider";
import { MENU } from "@/lib/menu";
import { can } from "@/lib/auth";
import { CommandPalette } from "@/components/command-palette";
import { OfflineRegister } from "@/components/offline-register";
import { SignOutButton } from "@/components/sign-out-button";
import { NavLinks } from "./nav-links";
import { BranchSwitcher, BusinessSwitcher, IdleLock, LockButton } from "./header-controls";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const ctx = await requireBusiness();
  const { business, user, role, membership, branchId } = ctx;
  const t = translator(user.uiLanguage);
  const endOfToday = new Date(`${new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" })}T23:59:59+05:30`);
  const [memberships, branches, followUpsDue] = await Promise.all([
    db.membership.findMany({ where: { userId: user.id }, include: { business: { select: { id: true, name: true } } }, orderBy: { createdAt: "asc" } }),
    db.branch.findMany({ where: { businessId: business.id, archivedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.followUp.count({ where: { businessId: business.id, assignedToId: user.id, doneAt: null, dueAt: { lte: endOfToday }, party: partyWhere(ctx) } }),
  ]);
  const tiedBranch = membership.branchId ? branches.find((b) => b.id === membership.branchId) : null;

  return (
    <I18nProvider lang={user.uiLanguage} mode={user.uiMode}>
      <div className="min-h-screen pb-20 md:pb-0" lang={user.uiLanguage}>
        <OfflineRegister />
        <CommandPalette screens={MENU.filter((m) => !m.permission || can(role, m.permission)).map((m) => ({ href: m.href, label: m.label, hint: m.about }))} />
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
            <nav className="hidden md:block"><NavLinks followUpsDue={followUpsDue} /></nav>
            <div className="flex items-center gap-2 text-sm text-muted">
              <form action="/search" role="search" className="hidden lg:block">
                <input name="q" placeholder={`${t("nav.search")}…`} aria-label={t("nav.search")} className="w-40 rounded-lg border border-line bg-bg px-2.5 py-1 text-sm outline-none focus:w-56 focus:border-brand" />
              </form>
              <Link href="/search" aria-label={t("nav.search")} className="rounded-lg px-1.5 py-1 hover:bg-bg lg:hidden">🔍</Link>
              <Link href="/settings/security" className="hidden hover:text-ink sm:inline">
                {user.name ?? `+${user.phone}`} · {role.toLowerCase()}{user.uiMode === "ACCOUNTANT" && " · accountant view"}
              </Link>
              {user.pinHash && <LockButton />}
              <SignOutButton action={logout} label={t("nav.signout")} />
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
        <nav className="no-print fixed inset-x-0 bottom-0 border-t border-line bg-card md:hidden"><NavLinks mobile followUpsDue={followUpsDue} /></nav>
      </div>
    </I18nProvider>
  );
}
