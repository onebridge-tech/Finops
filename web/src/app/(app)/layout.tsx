import Link from "next/link";
import { can, partyWhere, requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import { translator } from "@/lib/i18n";
import { logout } from "@/app/actions/auth";
import { I18nProvider } from "@/components/i18n-provider";
import { MENU } from "@/lib/menu";
import { Avatar } from "@/components/ui";
import { Icon, Logo } from "@/components/icon";
import { BRAND } from "@/lib/brand";
import { CommandPalette } from "@/components/command-palette";
import { OfflineRegister } from "@/components/offline-register";
import { SignOutButton } from "@/components/sign-out-button";
import { isPlatformAdmin } from "@/lib/platform-auth";
import { BottomNav, SideNav, type NavGroup, type NavItem } from "./nav-links";
import { BranchSwitcher, BusinessSwitcher, IdleLock, LockButton } from "./header-controls";
import { userLabel } from "@/lib/identity";

const GROUP_TITLE = { Sell: "Selling", Stock: "Items & stock", Money: "Money", Field: "On the road", Business: "Your shop" } as const;

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const ctx = await requireBusiness();
  const { business, user, role, membership, branchId } = ctx;
  const t = translator(user.uiLanguage);
  const endOfToday = new Date(`${new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" })}T23:59:59+05:30`);
  const [memberships, branches, followUpsDue, outboxWaiting] = await Promise.all([
    db.membership.findMany({ where: { userId: user.id }, include: { business: { select: { id: true, name: true } } }, orderBy: { createdAt: "asc" } }),
    db.branch.findMany({ where: { businessId: business.id, archivedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.followUp.count({ where: { businessId: business.id, assignedToId: user.id, doneAt: null, dueAt: { lte: endOfToday }, party: partyWhere(ctx) } }),
    can(role, "reminder:send") ? db.message.count({ where: { businessId: business.id, channel: "WHATSAPP_LINK", status: "QUEUED", party: partyWhere(ctx) } }) : Promise.resolve(0),
  ]);
  const tiedBranch = membership.branchId ? branches.find((b) => b.id === membership.branchId) : null;
  const visible = MENU.filter((m) => !m.permission || can(role, m.permission));

  const core: NavItem[] = [
    { href: "/dashboard", label: t("nav.home"), icon: "home" },
    { href: "/parties", label: t("nav.parties"), icon: "users" },
    { href: "/invoices", label: t("nav.invoices"), icon: "bill" },
    { href: "/collections", label: t("nav.collect"), icon: "rupee" },
    { href: "/follow-ups", label: t("nav.followups"), icon: "phone", badge: followUpsDue },
  ];
  const groups: NavGroup[] = [{ items: core }];
  for (const g of ["Sell", "Stock", "Money", "Field", "Business"] as const) {
    const items = visible.filter((m) => m.group === g).map((m): NavItem => ({ href: m.href, label: m.label, icon: m.icon as NavItem["icon"], badge: m.href === "/outbox" ? outboxWaiting : undefined }));
    if (items.length) groups.push({ title: GROUP_TITLE[g], items });
  }
  const name = userLabel(user);
  if (isPlatformAdmin(user)) groups.push({ title: "Platform", items: [{ href: "/platform", label: "Platform admin", icon: "chart" }] });

  return (
    <I18nProvider lang={user.uiLanguage} mode={user.uiMode}>
      <div className="min-h-screen pb-20 lg:pb-0" lang={user.uiLanguage}>
        {user.pinHash && <IdleLock minutes={user.lockAfterMin} />}
        <OfflineRegister />
        <CommandPalette screens={visible.map((m) => ({ href: m.href, label: m.label, hint: m.about }))} />

        <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-line bg-card lg:flex">
          <Link href="/dashboard" className="flex items-center gap-2.5 px-5 py-4 text-lg font-semibold tracking-tight" aria-label={`${BRAND.NAME} home`}>
            <Logo size={30} />{BRAND.NAME}
          </Link>
          <div className="space-y-2 px-3 pb-3">
            <BusinessSwitcher current={business.id} businesses={memberships.map((m) => m.business)} />
            {tiedBranch ? (
              <span className="block rounded-lg border border-line px-2.5 py-1.5 text-xs text-muted">{tiedBranch.name}</span>
            ) : (
              branches.length > 0 && <BranchSwitcher current={branchId ?? ""} branches={branches} />
            )}
          </div>
          <SideNav groups={groups} />
          <div className="flex items-center gap-2.5 border-t border-line p-3">
            <Avatar name={name} size={32} />
            <Link href="/settings/security" className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-sm font-medium">{name}</span>
              <span className="block truncate text-xs capitalize text-muted">{role.toLowerCase()}{user.uiMode === "ACCOUNTANT" && " · accountant view"}</span>
            </Link>
            {user.pinHash && <LockButton />}
            <SignOutButton action={logout} label={t("nav.signout")} className="flex size-9 items-center justify-center rounded-lg text-muted hover:bg-bg hover:text-ink">
              <Icon name="logout" size={18} />
            </SignOutButton>
          </div>
        </aside>

        <div className="lg:pl-60">
          <header className="no-print sticky top-0 z-20 border-b border-line bg-card/85 backdrop-blur">
            <div className="flex h-14 items-center gap-3 px-4 sm:px-6 lg:px-8">
              <Link href="/dashboard" className="flex items-center gap-2 font-semibold lg:hidden" aria-label={`${BRAND.NAME} home`}><Logo size={28} /></Link>
              <div className="min-w-0 flex-1 lg:hidden"><BusinessSwitcher current={business.id} businesses={memberships.map((m) => m.business)} /></div>
              <form action="/search" role="search" className="relative hidden max-w-md flex-1 lg:block">
                <Icon name="search" size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input name="q" placeholder={`${t("nav.search")} — name, phone, bill number…`} aria-label={t("nav.search")} className="h-9 w-full rounded-lg border border-line bg-bg pl-9 pr-14 text-sm outline-none placeholder:text-muted/70 focus:border-brand focus:bg-card focus:ring-2 focus:ring-brand/20" />
                <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-line bg-card px-1.5 text-[11px] text-muted">Ctrl K</kbd>
              </form>
              <div className="ml-auto flex items-center gap-1 lg:ml-0">
                <Link href="/search" aria-label={t("nav.search")} className="flex size-9 items-center justify-center rounded-lg text-muted hover:bg-bg lg:hidden"><Icon name="search" size={18} /></Link>
                {user.pinHash && <span className="lg:hidden"><LockButton /></span>}
                <SignOutButton action={logout} label={t("nav.signout")} className="flex size-9 items-center justify-center rounded-lg text-muted hover:bg-bg hover:text-ink lg:hidden">
                  <Icon name="logout" size={18} />
                </SignOutButton>
              </div>
            </div>
          </header>
          <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">{children}</main>
        </div>

        <nav aria-label="Quick" className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-line bg-card/95 backdrop-blur lg:hidden">
          <BottomNav items={core} moreBadge={outboxWaiting} moreLabel={t("nav.more")} morePaths={[...visible.map((m) => m.href), "/search"]} />
        </nav>
      </div>
    </I18nProvider>
  );
}
