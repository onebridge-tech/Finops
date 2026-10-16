import Link from "next/link";
import { Card, PageHeader } from "@/components/ui";
import { Icon } from "@/components/icon";
import { LEGAL_PAGES } from "@/lib/legal";
import { SITE_FIELDS, getSite } from "@/lib/site-settings";
import { SiteInfoForm } from "./site-info-form";

export const metadata = { title: "Company info · Platform admin" };
export const dynamic = "force-dynamic";

export default async function CompanyInfo() {
  const site = await getSite();
  // Only the details that have no built-in answer count towards "filled in".
  const needed = SITE_FIELDS.filter((f) => !f.default);
  const filled = needed.filter((f) => site[f.key]).length;
  const done = filled === needed.length;

  return (
    <>
      <PageHeader title="Company info" sub="The details your customers see on the Terms, Privacy and Contact pages. Fill in what you have; anything left empty is simply not shown." />
      <Card className={`mb-6 flex flex-wrap items-center gap-4 ${done ? "border-got/30 bg-got/5" : "border-brand/30 bg-brand-soft"}`}>
        <span className={`flex size-10 items-center justify-center rounded-full ${done ? "bg-got/15 text-got" : "bg-brand text-brand-ink"}`}><Icon name={done ? "check" : "shop"} size={20} /></span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{done ? "Everything is filled in" : `${filled} of ${needed.length} details filled in`}</p>
          <p className="text-sm text-muted">{done ? "Your legal pages are complete." : "Before you go live, add the rest so customers can reach you and your Grievance Officer."}</p>
          <div className="mt-2 h-1.5 max-w-xs overflow-hidden rounded-full bg-line"><div className="h-full rounded-full bg-brand transition-all" style={{ width: `${(filled / needed.length) * 100}%` }} /></div>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {LEGAL_PAGES.slice(0, 2).concat(LEGAL_PAGES.slice(5)).map((p) => <Link key={p.href} href={p.href} target="_blank" className="font-medium text-brand underline">See {p.label}</Link>)}
        </div>
      </Card>
      <SiteInfoForm values={Object.fromEntries(SITE_FIELDS.map((f) => [f.key, site[f.key]]))} />
    </>
  );
}
