import Link from "next/link";
import { requireBusiness } from "@/lib/auth";
import { REPORT_KINDS, REPORT_TITLES } from "@/lib/report-runner";
import { Card, PageHeader } from "@/components/ui";
import { Icon, type IconName } from "@/components/icon";

export const metadata = { title: "Reports" };

const ICON: Record<string, IconName> = {
  ageing: "clock", daybook: "note", top: "trend", sales: "chart", expenses: "wallet", sources: "users", orders: "cart", stock: "box", attendance: "calendar", missed: "walk",
};

export default async function Reports() {
  await requireBusiness("reports:view");
  const cards: { href: string; icon: IconName; name: string; about: string }[] = [
    ...REPORT_KINDS.map((k) => ({ href: `/reports/${k}`, icon: ICON[k] ?? "chart", name: REPORT_TITLES[k].name, about: REPORT_TITLES[k].about })),
    { href: "/cashbook", icon: "wallet", name: "Cash in the drawer", about: "Daily cash in and out, with day close" },
    { href: "/settings/audit", icon: "lock", name: "Who changed what", about: "Every change, checked so it cannot be edited" },
  ];
  return (
    <>
      <PageHeader title="Reports" sub="Every report can be downloaded to Excel or printed." />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <Link key={c.href} href={c.href}>
            <Card className="flex h-full items-start gap-3 p-4 transition hover:border-brand/40 hover:shadow-md sm:p-4">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand"><Icon name={c.icon} size={20} /></span>
              <span>
                <span className="block font-semibold">{c.name}</span>
                <span className="text-[13px] leading-snug text-muted">{c.about}</span>
              </span>
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}
