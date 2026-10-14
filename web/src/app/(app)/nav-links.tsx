"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "@/components/i18n-provider";
import type { UiKey } from "@/lib/i18n";
import { Icon, type IconName } from "@/components/icon";

// Icons keep the phone nav readable in every language, even when labels are truncated.
const LINKS: [string, UiKey, IconName][] = [
  ["/dashboard", "nav.home", "home"],
  ["/parties", "nav.parties", "users"],
  ["/invoices", "nav.invoices", "bill"],
  ["/collections", "nav.collect", "rupee"],
  ["/follow-ups", "nav.followups", "phone"],
  ["/more", "nav.more", "grid"],
];

export function NavLinks({ mobile = false, followUpsDue = 0 }: { mobile?: boolean; followUpsDue?: number }) {
  const path = usePathname();
  const t = useT();
  return (
    <ul className={mobile ? "grid grid-cols-6 text-center text-[11px] font-medium leading-[1.15]" : "flex gap-1"}>
      {LINKS.map(([href, key, icon]) => {
        // "More" stays highlighted on the screens it leads to.
        const moreRoutes = ["/items", "/stock", "/orders", "/notes", "/quotes", "/price-lists", "/expenses", "/cashbook", "/reports", "/field", "/data", "/settings", "/search"];
        const active = href === "/more" ? path === "/more" || moreRoutes.some((r) => path === r || path.startsWith(r + "/")) : path === href || path.startsWith(href + "/");
        return (
          <li key={href} className="min-w-0">
            <Link
              href={href}
              className={`relative block rounded-lg ${mobile ? "min-h-16 px-0.5 pb-2 pt-2" : "px-3.5 py-2 text-base"} ${active ? "font-bold text-brand" : "text-muted hover:text-ink"}`}
            >
              {mobile && <span className="mx-auto mb-0.5 flex h-7 w-12 items-center justify-center" aria-hidden><Icon name={icon} size={22} /></span>}
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
