import Link from "next/link";
import { requireBusiness } from "@/lib/auth";
import { REPORT_KINDS, REPORT_TITLES } from "@/lib/report-runner";
import { Card, PageHeader } from "@/components/ui";

export const metadata = { title: "Reports" };

export default async function Reports() {
  await requireBusiness("reports:view");
  return (
    <>
      <PageHeader title="Reports" sub="Every report can be downloaded to Excel or printed." />
      <div className="grid gap-3 sm:grid-cols-2">
        {REPORT_KINDS.map((k) => (
          <Link key={k} href={`/reports/${k}`}>
            <Card className="h-full hover:bg-bg">
              <p className="font-semibold">{REPORT_TITLES[k].name}</p>
              <p className="mt-1 text-base text-muted">{REPORT_TITLES[k].about}</p>
            </Card>
          </Link>
        ))}
        <Link href="/cashbook"><Card className="h-full hover:bg-bg"><p className="font-semibold">Cash in the drawer</p><p className="mt-1 text-base text-muted">Daily cash in and out, with day close</p></Card></Link>
        <Link href="/settings/audit"><Card className="h-full hover:bg-bg"><p className="font-semibold">Who changed what</p><p className="mt-1 text-base text-muted">Who changed what, tamper-checked</p></Card></Link>
      </div>
    </>
  );
}
