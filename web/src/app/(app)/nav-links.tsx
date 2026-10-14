"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/icon";

export type NavItem = { href: string; label: string; icon: IconName; badge?: number };
export type NavGroup = { title?: string; items: NavItem[] };

/** The item whose address is the longest match for the current page, so "Settings" is not lit up on the Tally page. */
function useActive(all: NavItem[]) {
  const path = usePathname();
  let best = "";
  for (const i of all) if ((path === i.href || path.startsWith(i.href + "/")) && i.href.length > best.length) best = i.href;
  return best;
}

/** Left menu on a computer. */
export function SideNav({ groups }: { groups: NavGroup[] }) {
  const active = useActive(groups.flatMap((g) => g.items));
  return (
    <nav aria-label="Sections" className="flex-1 space-y-5 overflow-y-auto px-3 py-2">
      {groups.map((g, n) => (
        <div key={n}>
          {g.title && <p className="mb-1 px-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted/80">{g.title}</p>}
          <ul className="space-y-0.5">
            {g.items.map((i) => {
              const on = active === i.href;
              return (
                <li key={i.href}>
                  <Link
                    href={i.href}
                    aria-current={on ? "page" : undefined}
                    className={`group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition ${on ? "bg-brand-soft text-brand" : "text-muted hover:bg-bg hover:text-ink"}`}
                  >
                    <Icon name={i.icon} size={18} className={on ? "" : "opacity-80 group-hover:opacity-100"} />
                    <span className="flex-1 truncate">{i.label}</span>
                    {!!i.badge && <span className="rounded-full bg-gave px-1.5 text-[11px] font-semibold leading-5 text-white" aria-label={`${i.badge} due`}>{i.badge}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

/** Bottom bar on a phone. */
export function BottomNav({ items, moreLabel, morePaths }: { items: NavItem[]; moreLabel: string; morePaths: string[] }) {
  const all: NavItem[] = [...items, { href: "/more", label: moreLabel, icon: "grid" }];
  const path = usePathname();
  const active = useActive(all);
  // "More" is lit on every screen that is reached through it.
  const inMore = path === "/more" || (!items.some((i) => path === i.href || path.startsWith(i.href + "/")) && morePaths.some((p) => path === p || path.startsWith(p + "/")));
  return (
    <ul className="grid grid-cols-6 px-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] pt-1">
      {all.map((i) => {
        const on = i.href === "/more" ? inMore : active === i.href;
        return (
          <li key={i.href} className="min-w-0">
            <Link href={i.href} aria-current={on ? "page" : undefined} className={`relative flex flex-col items-center gap-0.5 rounded-lg px-0.5 py-1 text-[11px] font-medium leading-tight ${on ? "text-brand" : "text-muted"}`}>
              <span className={`flex h-7 w-12 items-center justify-center rounded-full transition ${on ? "bg-brand-soft" : ""}`}><Icon name={i.icon} size={20} /></span>
              <span className="max-w-full truncate">{i.label}</span>
              {!!i.badge && <span className="absolute right-2 top-0 rounded-full bg-gave px-1.5 text-[10px] font-semibold leading-4 text-white" aria-label={`${i.badge} due`}>{i.badge}</span>}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
