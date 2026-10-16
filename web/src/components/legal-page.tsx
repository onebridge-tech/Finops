import Link from "next/link";
import type { ReactNode } from "react";
import { BRAND } from "@/lib/brand";
import { LEGAL, LEGAL_PAGES } from "@/lib/legal";
import { getSite } from "@/lib/site-settings";
import { Logo } from "@/components/icon";

/** Small footer with every legal page, used on public pages. */
export function LegalLinks({ className = "" }: { className?: string }) {
  return (
    <nav aria-label="Legal" className={`flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted ${className}`}>
      {LEGAL_PAGES.map((p) => <Link key={p.href} href={p.href} className="hover:text-ink hover:underline">{p.label}</Link>)}
    </nav>
  );
}

/** Shared frame for the legal documents: a plain, readable page with the list of the other documents on the side. */
export async function LegalPage({ title, intro, children }: { title: string; intro?: ReactNode; children: ReactNode }) {
  const site = await getSite();
  return (
    <div className="min-h-screen bg-bg">
      <header className="border-b border-line bg-card">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-5">
          <Link href="/" className="flex items-center gap-2 font-semibold"><Logo size={28} />{BRAND.NAME}</Link>
          <Link href="/login" className="text-sm font-medium text-brand hover:underline">Sign in</Link>
        </div>
      </header>
      <div className="mx-auto max-w-5xl gap-10 px-5 py-8 lg:flex">
        <aside className="mb-6 lg:mb-0 lg:w-56 lg:shrink-0">
          <nav aria-label="Legal documents" className="flex gap-1 overflow-x-auto pb-1 lg:sticky lg:top-6 lg:flex-col">
            {LEGAL_PAGES.map((p) => (
              <Link key={p.href} href={p.href} className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition hover:bg-card ${p.label === title ? "bg-card text-ink shadow-sm" : "text-muted"}`}>{p.label}</Link>
            ))}
          </nav>
        </aside>
        <article className="min-w-0 max-w-3xl flex-1 pb-16">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-1 text-sm text-muted">Last updated {LEGAL.UPDATED}</p>
          {intro && <p className="mt-4 rounded-xl border border-line bg-card p-4 text-[15px] leading-relaxed">{intro}</p>}
          <div className="legal mt-6 space-y-8 text-[15px] leading-relaxed">{children}</div>
        </article>
      </div>
      <footer className="border-t border-line bg-card">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-5 py-5">
          <span className="text-xs text-muted">© {new Date().getFullYear()} {site.company || BRAND.NAME}.{site.company ? ` ${BRAND.NAME} is a product of ${site.company}.` : ""}</span>
          <LegalLinks />
        </div>
      </footer>
    </div>
  );
}

/** An email link, or nothing when the address has not been filled in. */
export function Mail({ to, className = "" }: { to: string; className?: string }) {
  return to ? <a className={className} href={`mailto:${to}`}>{to}</a> : null;
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-lg font-semibold tracking-tight">{title}</h2>
      <div className="space-y-3 text-muted [&_a]:font-medium [&_a]:text-brand [&_a]:underline [&_b]:font-semibold [&_b]:text-ink [&_li]:pl-1 [&_ol]:list-decimal [&_ol]:space-y-1.5 [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5">{children}</div>
    </section>
  );
}
