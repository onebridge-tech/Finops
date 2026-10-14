import Link from "next/link";
import { can, requireBusiness } from "@/lib/auth";
import { MENU } from "@/lib/menu";
import { Card, PageHeader } from "@/components/ui";
import { Icon, isIconName } from "@/components/icon";

export const metadata = { title: "More" };

const GROUPS = ["Sell", "Stock", "Money", "Field", "Business"] as const;
const GROUP_NAME: Record<(typeof GROUPS)[number], string> = { Sell: "Selling", Stock: "Items & stock", Money: "Money", Field: "On the road", Business: "Your shop" };

export default async function More() {
  const { role } = await requireBusiness();
  return (
    <>
      <PageHeader title="Everything else" sub="Tap what you need." />
      <div className="space-y-6">
        {GROUPS.map((g) => {
          const items = MENU.filter((m) => m.group === g && (!m.permission || can(role, m.permission)));
          if (items.length === 0) return null;
          return (
            <section key={g}>
              <h2 className="mb-2 text-lg font-bold">{GROUP_NAME[g]}</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((m) => (
                  <Link key={m.href} href={m.href}>
                    <Card className="flex h-full items-start gap-3 hover:bg-bg">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">{isIconName(m.icon) && <Icon name={m.icon} />}</span>
                      <span><span className="block text-lg font-semibold">{m.label}</span><span className="text-base text-muted">{m.about}</span></span>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
