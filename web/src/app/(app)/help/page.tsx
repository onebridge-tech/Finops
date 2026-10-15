import Link from "next/link";
import { requireBusiness } from "@/lib/auth";
import { GUIDE_GROUPS, HELP } from "@/lib/help";
import { Card, PageHeader } from "@/components/ui";
import { Icon } from "@/components/icon";

export const metadata = { title: "Help & guide" };

export default async function Help() {
  await requireBusiness();
  return (
    <>
      <PageHeader title="Help & guide" sub="What every screen is for, in simple words. Tap a name to open it." />
      <div className="space-y-8">
        {GUIDE_GROUPS.map((g) => {
          const items = HELP.filter((h) => h.group === g && h.guide);
          return (
            <section key={g}>
              <h2 className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-muted">{g}</h2>
              <div className="grid gap-3 md:grid-cols-2">
                {items.map((h) => (
                  <Card key={h.path} className="p-4 sm:p-4">
                    <Link href={h.path} className="flex items-center gap-2 font-semibold hover:text-brand">
                      <span className="flex size-8 items-center justify-center rounded-lg bg-brand-soft text-brand"><Icon name={h.icon} size={18} /></span>{h.title}
                    </Link>
                    <p className="mt-2 text-[13px] leading-relaxed text-muted">{h.text}</p>
                  </Card>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
