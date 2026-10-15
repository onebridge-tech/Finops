import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/platform-auth";
import { Badge } from "@/components/ui";
import { Icon, Logo } from "@/components/icon";
import { BRAND } from "@/lib/brand";
import { PlatformNav } from "./platform-nav";

export const metadata = { title: "Platform admin", robots: { index: false, follow: false } };

export default async function PlatformLayout({ children }: LayoutProps<"/platform">) {
  await requirePlatformAdmin();
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-line bg-card/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4 sm:px-6">
          <Link href="/platform" className="flex items-center gap-2 font-semibold tracking-tight"><Logo size={28} />{BRAND.NAME}<Badge tone="brand">Platform admin</Badge></Link>
          <div className="min-w-0 flex-1"><PlatformNav /></div>
          <Link href="/dashboard" className="hidden items-center gap-1.5 text-sm text-muted hover:text-ink sm:flex"><Icon name="home" size={16} />Back to app</Link>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  );
}
