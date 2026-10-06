"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "@/components/i18n-provider";
import type { UiKey } from "@/lib/i18n";

// Icons keep the phone nav readable in every language, even when labels are truncated.
const LINKS: [string, UiKey, string][] = [
  ["/dashboard", "nav.home", "🏠"],
  ["/parties", "nav.parties", "👥"],
  ["/invoices", "nav.invoices", "🧾"],
  ["/collections", "nav.collect", "💰"],
  ["/follow-ups", "nav.followups", "📞"],
  ["/more", "nav.more", "☰"],
];

export function NavLinks({ mobile = false, followUpsDue = 0 }: { mobile?: boolean; followUpsDue?: number }) {
  const path = usePathname();
  const t = useT();
  return (
    <ul className={mobile ? "grid grid-cols-6 text-center text-[11px] leading-tight" : "flex gap-1 text-sm"}>
      {LINKS.map(([href, key, icon]) => {
        // "More" stays highlighted on the screens it leads to.
        const moreRoutes = ["/items", "/stock", "/orders", "/notes", "/quotes", "/price-lists", "/expenses", "/cashbook", "/reports", "/field", "/data", "/settings", "/search"];
        const active = href === "/more" ? path === "/more" || moreRoutes.some((r) => path === r || path.startsWith(r + "/")) : path === href || path.startsWith(href + "/");
        return (
          <li key={href} className="min-w-0">
            <Link
              href={href}
              className={`relative block rounded-lg ${mobile ? "truncate px-0.5 pb-2 pt-1.5" : "px-3 py-1.5"} ${active ? "font-semibold text-brand" : "text-muted hover:text-ink"}`}
            >
              {mobile && <span className="block text-base leading-5" aria-hidden>{icon}</span>}
              {t(key)}
              {href === "/follow-ups" && followUpsDue > 0 && (
                <span className={`ml-1 rounded-full bg-gave px-1.5 text-[10px] font-semibold text-white ${mobile ? "absolute right-0 top-1" : ""}`} aria-label={`${followUpsDue} due`}>
                  {followUpsDue}
                </span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
