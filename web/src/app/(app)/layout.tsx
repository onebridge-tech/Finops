import Link from "next/link";
import { requireBusiness } from "@/lib/auth";
import { logout } from "@/app/actions/auth";
import { NavLinks } from "./nav-links";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const { business, user, role } = await requireBusiness();
  return (
    <div className="min-h-screen pb-20 md:pb-0">
      <header className="no-print border-b border-line bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/dashboard" className="truncate font-semibold">{business.name}</Link>
          <nav className="hidden md:block"><NavLinks /></nav>
          <form action={logout} className="flex items-center gap-3 text-sm text-muted">
            <span className="hidden sm:inline">+{user.phone} · {role.toLowerCase()}</span>
            <button className="hover:text-ink">Sign out</button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      <nav className="no-print fixed inset-x-0 bottom-0 border-t border-line bg-card md:hidden"><NavLinks mobile /></nav>
    </div>
  );
}
