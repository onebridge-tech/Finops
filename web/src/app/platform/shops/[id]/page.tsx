import Link from "next/link";
import { notFound } from "next/navigation";
import { shopDetail } from "@/lib/platform";
import { platformAudit, requirePlatformAdmin } from "@/lib/platform-auth";
import { userLabel } from "@/lib/identity";
import { formatINR } from "@/lib/money";
import { Avatar, Badge, Card, PageHeader, SectionTitle, StatCard } from "@/components/ui";
import { Bars, since } from "../../bars";

export const metadata = { title: "Shop · Platform admin" };
export const dynamic = "force-dynamic";

const yesNo = (v: boolean) => (v ? <Badge tone="good">On</Badge> : <Badge>Off</Badge>);

export default async function ShopPage({ params }: PageProps<"/platform/shops/[id]">) {
  const { id } = await params;
  const admin = await requirePlatformAdmin();
  const d = await shopDetail(id);
  if (!d) notFound();
  await platformAudit(admin.id, "view_shop", id);
  const b = d.business;
  const sent = (d.messages.SENT ?? 0) + (d.messages.DELIVERED ?? 0) + (d.messages.READ ?? 0);
  const paid = d.payments.find((p) => p.status === "PAID");

  return (
    <>
      <PageHeader
        leading={<Avatar name={b.name} size={44} />}
        title={b.name}
        sub={`Joined ${b.createdAt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" })} · last active ${since(d.lastActive)}`}
        action={<Link href="/platform/shops" className="text-sm text-muted hover:text-ink">← All shops</Link>}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon="users" label="Customers" value={String(d.counts.parties)} hint={`${d.counts.suppliers} suppliers`} />
        <StatCard icon="bill" label="Bills" value={String(d.counts.invoices)} hint={`${d.counts.quotes} quotes · ${d.counts.orders} orders`} />
        <StatCard icon="note" label="Entries written" value={String(d.counts.entries)} />
        <StatCard icon="box" label="Items" value={String(d.counts.items)} />
      </div>

      <SectionTitle>Last 14 days</SectionTitle>
      <Card className="grid gap-6 sm:grid-cols-2">
        <Bars series={d.entriesSeries} label="Entries written" tone="got" />
        <Bars series={d.billsSeries} label="Bills made" tone="warn" />
      </Card>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section>
          <SectionTitle>People ({d.members.length})</SectionTitle>
          <Card className="divide-y divide-line p-0 sm:p-0">
            {d.members.map((m) => (
              <div key={m.user.id} className="flex items-center gap-3 px-4 py-3">
                <Avatar name={userLabel(m.user)} size={34} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{userLabel(m.user)}</span>
                  <span className="block truncate text-xs text-muted">{[m.user.phone && `+${m.user.phone}`, m.user.email, m.user.googleSub && "Google"].filter(Boolean).join(" · ")}</span>
                </span>
                <span className="text-right">
                  <Badge tone={m.role === "OWNER" ? "brand" : "neutral"}>{m.role.toLowerCase()}</Badge>
                  <span className="mt-1 block text-xs text-muted">{since(m.lastActive)}</span>
                </span>
              </div>
            ))}
          </Card>
        </section>

        <section>
          <SectionTitle>Setup</SectionTitle>
          <Card className="divide-y divide-line p-0 sm:p-0">
            {[
              ["UPI ID added", !!b.upiId], ["GSTIN added", !!b.gstin], ["Automatic reminders", b.reminderEnabled], ["Item list shared", b.catalogEnabled],
              ["Tally connected", !!b.tallyLastSyncAt], ["Branches", d.counts.branches > 0],
            ].map(([label, on]) => (
              <div key={label as string} className="flex items-center justify-between px-4 py-2.5"><span>{label}</span>{yesNo(on as boolean)}</div>
            ))}
            <div className="flex items-center justify-between px-4 py-2.5"><span>Message credits left</span><span className="font-semibold tabular-nums">{b.creditBalance}</span></div>
            <div className="flex items-center justify-between px-4 py-2.5"><span>Shops this one brought in</span><span className="tabular-nums">{d.counts.referred}</span></div>
          </Card>
        </section>

        <section>
          <SectionTitle>Messages (30 days)</SectionTitle>
          <Card className="space-y-3">
            <p><span className="text-2xl font-semibold tabular-nums">{sent}</span> <span className="text-muted">sent or delivered</span></p>
            <p className="text-sm text-muted">{d.messages.FAILED ?? 0} failed · {d.messages.SKIPPED ?? 0} skipped</p>
            {d.failed.length > 0 && (
              <ul className="divide-y divide-line border-t border-line text-sm">
                {d.failed.map((f) => (
                  <li key={f.id} className="py-2"><span className="font-medium">{f.kind.toLowerCase().replace("_", " ")}</span> · {f.channel.toLowerCase()} · <span className="text-gave">{f.status.toLowerCase()}</span><span className="block text-xs text-muted">{f.error ?? "No reason given"} · {since(f.createdAt)}</span></li>
                ))}
              </ul>
            )}
          </Card>
        </section>

        <section>
          <SectionTitle>Online payments</SectionTitle>
          <Card>
            <p><span className="text-2xl font-semibold tabular-nums">{formatINR(paid?.paise ?? 0)}</span> <span className="text-muted">received in {paid?.count ?? 0} payments</span></p>
            <p className="mt-1 text-sm text-muted">{d.payments.filter((p) => p.status !== "PAID").map((p) => `${p.count} ${p.status.toLowerCase()}`).join(" · ") || "No other attempts"}</p>
          </Card>
        </section>
      </div>
    </>
  );
}
