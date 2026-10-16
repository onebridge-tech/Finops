"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [["/platform", "Overview"], ["/platform/shops", "Shops"], ["/platform/users", "People"], ["/platform/growth", "Growth"], ["/platform/health", "Health"], ["/platform/errors", "Errors"], ["/platform/audit", "Admin log"], ["/platform/settings", "Company info"]] as const;

export function PlatformNav() {
  const path = usePathname();
  return (
    <nav aria-label="Platform admin" className="flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {TABS.map(([href, label]) => {
        const on = href === "/platform" ? path === href : path === href || path.startsWith(href + "/");
        return (
          <Link key={href} href={href} aria-current={on ? "page" : undefined}
            className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition ${on ? "bg-brand-soft text-brand" : "text-muted hover:bg-bg hover:text-ink"}`}>{label}</Link>
        );
      })}
    </nav>
  );
}
