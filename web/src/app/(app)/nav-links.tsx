"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  ["/dashboard", "Home"],
  ["/parties", "Parties"],
  ["/invoices", "Invoices"],
  ["/items", "Items"],
  ["/settings", "Settings"],
] as const;

export function NavLinks({ mobile = false }: { mobile?: boolean }) {
  const path = usePathname();
  return (
    <ul className={mobile ? "grid grid-cols-5 text-center text-xs" : "flex gap-1 text-sm"}>
      {LINKS.map(([href, label]) => {
        const active = path === href || path.startsWith(href + "/");
        return (
          <li key={href}>
            <Link
              href={href}
              className={`block rounded-lg ${mobile ? "py-3" : "px-3 py-1.5"} ${active ? "font-semibold text-brand" : "text-muted hover:text-ink"}`}
            >
              {label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
