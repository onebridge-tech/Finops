import Link from "next/link";
import { can, requireBusiness } from "@/lib/auth";
import { MENU } from "@/lib/menu";
import { Card, PageHeader } from "@/components/ui";

export const metadata = { title: "More" };

const GROUPS = ["Sell", "Stock", "Money", "Field", "Business"] as const;

export default async function More() {
  const { role } = await requireBusiness();
  return (
    <>
      <PageHeader title="More" />
      <div className="space-y-6">
        {GROUPS.map((g) => {
          const items = MENU.filter((m) => m.group === g && (!m.permission || can(role, m.permission)));
          if (items.length === 0) return null;
          return (
            <section key={g}>
              <h2 className="mb-2 text-sm font-semibold text-muted">{g}</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((m) => (
                  <Link key={m.href} href={m.href}>
                    <Card className="flex h-full items-start gap-3 hover:bg-bg">
                      <span className="text-2xl" aria-hidden>{m.icon}</span>
                      <span><span className="block font-semibold">{m.label}</span><span className="text-sm text-muted">{m.about}</span></span>
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
