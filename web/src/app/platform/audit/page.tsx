import { db } from "@/lib/db";
import { userLabel } from "@/lib/identity";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { since } from "../bars";

export const metadata = { title: "Admin log · Platform admin" };
export const dynamic = "force-dynamic";

const WHAT: Record<string, string> = { view_shop: "Looked at shop" };

export default async function AdminLog() {
  const rows = await db.platformAudit.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
  const people = await db.user.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.actorId))] } }, select: { id: true, name: true, phone: true, email: true } });
  const shops = await db.business.findMany({ where: { id: { in: rows.flatMap((r) => (r.action === "view_shop" && r.target ? [r.target] : [])) } }, select: { id: true, name: true } });
  const who = new Map(people.map((p) => [p.id, userLabel(p)]));
  const shop = new Map(shops.map((s) => [s.id, s.name]));
  return (
    <>
      <PageHeader title="Admin log" sub="What platform admins looked at. This list can't be edited from the app." />
      {rows.length === 0 ? (
        <EmptyState icon="lock" title="Nothing recorded yet" />
      ) : (
        <Card className="divide-y divide-line p-0 sm:p-0">
          {rows.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <span><span className="font-medium">{who.get(r.actorId) ?? "Someone"}</span> <span className="text-muted">{WHAT[r.action] ?? r.action}</span> {r.target && <span>{shop.get(r.target) ?? r.target}</span>}</span>
              <span className="whitespace-nowrap text-xs text-muted">{since(r.createdAt)}</span>
            </div>
          ))}
        </Card>
      )}
    </>
  );
}
