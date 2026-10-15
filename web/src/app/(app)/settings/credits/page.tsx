import { can, requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import { CREDIT_PACKS } from "@/lib/credits";
import { daysAgo } from "@/lib/format";
import { Card, PageHeader, fmtDate } from "@/components/ui";
import { BuyCredits } from "./buy-credits";
import { userLabel } from "@/lib/identity";

export const metadata = { title: "Message credits" };

const REASON: Record<string, string> = { WELCOME: "Welcome credits", TOPUP: "Top-up", MESSAGE: "Message sent", REFUND: "Refund (not delivered)" };

export default async function Credits() {
  const { business, role } = await requireBusiness();
  const [txns, usage, members] = await Promise.all([
    db.creditTxn.findMany({ where: { businessId: business.id }, orderBy: { createdAt: "desc" }, take: 50 }),
    db.message.groupBy({
      by: ["createdById", "channel"],
      where: { businessId: business.id, createdAt: { gte: daysAgo(30) }, credits: { gt: 0 }, status: { notIn: ["FAILED", "SKIPPED"] } },
      _sum: { credits: true },
      _count: true,
    }),
    db.membership.findMany({ where: { businessId: business.id }, include: { user: true } }),
  ]);
  const who = (id: string | null) => {
    if (!id) return "Automatic";
    const m = members.find((x) => x.userId === id);
    return m ? (userLabel(m.user)) : "Former member";
  };

  return (
    <>
      <PageHeader title="Message credits" sub={`${business.creditBalance} credits available`} />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="space-y-3 lg:col-span-1">
          <h2 className="text-base font-semibold tracking-tight">Buy credits</h2>
          {can(role, "settings:write") ? <BuyCredits packs={CREDIT_PACKS.map((p) => ({ ...p }))} /> : <p className="text-sm text-muted">Ask the owner to buy credits.</p>}
        </Card>
        <Card className="lg:col-span-2">
          <h2 className="mb-3 text-base font-semibold tracking-tight">Usage in the last 30 days</h2>
          {usage.length === 0 ? (
            <p className="text-sm text-muted">No paid messages yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted">
                <tr><th className="py-1 font-medium">Sent by</th><th className="py-1 font-medium">Channel</th><th className="py-1 text-right font-medium">Messages</th><th className="py-1 text-right font-medium">Credits</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {usage.map((u) => (
                  <tr key={`${u.createdById}-${u.channel}`}>
                    <td className="py-2">{who(u.createdById)}</td>
                    <td className="py-2">{u.channel === "SMS" ? "SMS" : u.channel === "WHATSAPP" ? "WhatsApp" : u.channel}</td>
                    <td className="py-2 text-right tabular-nums">{u._count}</td>
                    <td className="py-2 text-right tabular-nums">{u._sum.credits ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      <h2 className="mb-2 mt-6 text-base font-semibold tracking-tight">History</h2>
      <Card className="divide-y divide-line p-0 text-sm">
        {txns.map((t) => (
          <div key={t.id} className="flex justify-between gap-3 px-4 py-2">
            <span>
              {REASON[t.reason] ?? t.reason}
              <span className="block text-xs text-muted">{fmtDate(t.createdAt)}{t.note && ` · ${t.note}`}</span>
            </span>
            <span className="text-right tabular-nums">
              <span className={t.delta > 0 ? "text-got" : ""}>{t.delta > 0 ? `+${t.delta}` : t.delta}</span>
              <span className="block text-xs text-muted">bal {t.balanceAfter}</span>
            </span>
          </div>
        ))}
      </Card>
    </>
  );
}
