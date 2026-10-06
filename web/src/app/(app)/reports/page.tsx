import Link from "next/link";
import { requireBusiness } from "@/lib/auth";
import { REPORT_KINDS, REPORT_TITLES } from "@/lib/report-runner";
import { Card, PageHeader } from "@/components/ui";

export const metadata = { title: "Reports" };

export default async function Reports() {
  await requireBusiness("reports:view");
  return (
    <>
      <PageHeader title="Reports" sub="Every report downloads to Excel or CSV and prints cleanly." />
      <div className="grid gap-3 sm:grid-cols-2">
        {REPORT_KINDS.map((k) => (
          <Link key={k} href={`/reports/${k}`}>
            <Card className="h-full hover:bg-bg">
              <p className="font-semibold">{REPORT_TITLES[k].name}</p>
              <p className="mt-1 text-sm text-muted">{REPORT_TITLES[k].about}</p>
            </Card>
          </Link>
        ))}
        <Link href="/cashbook"><Card className="h-full hover:bg-bg"><p className="font-semibold">Cashbook</p><p className="mt-1 text-sm text-muted">Daily cash in and out, with day close</p></Card></Link>
        <Link href="/settings/audit"><Card className="h-full hover:bg-bg"><p className="font-semibold">Audit trail</p><p className="mt-1 text-sm text-muted">Who changed what, tamper-checked</p></Card></Link>
      </div>
    </>
  );
}
