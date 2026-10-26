import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { logout } from "@/app/actions/auth";
import { isPlatformAdmin } from "@/lib/platform-auth";
import { Logo } from "@/components/icon";
import { BRAND } from "@/lib/brand";
import { SecurityView, type SecurityParams } from "@/app/(app)/settings/security/security-view";

export const metadata = { title: "You & your security", robots: { index: false, follow: false } };

// "You & your security" for someone with no shop: a platform admin setting their app-lock PIN, or a new
// person before they set up a business. The shop app's own page needs a business, so it can't be used here.
export default async function AccountSecurity({ searchParams }: PageProps<"/account/security">) {
  const { user, session } = await requireUser();
  const hasShop = (await db.membership.count({ where: { userId: user.id } })) > 0;
  const back = hasShop ? { href: "/dashboard", label: "Back to app" } : isPlatformAdmin(user) && user.pinHash ? { href: "/platform", label: "Platform admin" } : { href: "/onboarding", label: "Set up your business" };
  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-card">
        <div className="mx-auto flex h-14 max-w-4xl items-center gap-4 px-4 sm:px-6">
          <span className="flex flex-1 items-center gap-2 font-semibold tracking-tight"><Logo size={28} />{BRAND.NAME}</span>
          <Link href={back.href} className="text-sm text-muted hover:text-ink">{back.label}</Link>
          <form action={logout}><button className="text-sm text-muted underline hover:text-gave">Sign out</button></form>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
        <SecurityView sp={(await searchParams) as SecurityParams} user={user} sid={session.sid} />
      </main>
    </div>
  );
}
