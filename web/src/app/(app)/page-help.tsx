"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/icon";
import { helpFor } from "@/lib/help";

/** A folded "What is this page?" note under the top bar, written in plain words for every screen. */
export function PageHelp() {
  const path = usePathname();
  const h = helpFor(path);
  if (!h || path === "/help") return null;
  return (
    <details key={path} className="group mb-4 rounded-lg border border-line bg-card text-sm shadow-sm">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 font-medium text-brand [&::-webkit-details-marker]:hidden">
        <Icon name="help" size={16} />What is this page for?
        <Icon name="chevron" size={14} className="ml-auto text-muted transition group-open:rotate-90" />
      </summary>
      <div className="border-t border-line px-3 py-2.5 leading-relaxed text-muted">
        {h.text} <Link href="/help" className="whitespace-nowrap font-medium text-brand underline">All screens explained</Link>
      </div>
    </details>
  );
}
