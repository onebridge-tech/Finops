import { overview } from "@/lib/platform";
import { formatINR } from "@/lib/money";
import { Card, PageHeader, SectionTitle, StatCard } from "@/components/ui";
import { Bars } from "./bars";

export const metadata = { title: "Platform overview" };
export const dynamic = "force-dynamic";

const pct = (a: number, b: number) => (b === 0 ? "—" : `${Math.round((a / b) * 100)}%`);

export default async function PlatformHome() {
  const d = await overview();
  const trend = d.entriesPrev7 === 0 ? undefined : `${d.entries7 >= d.entriesPrev7 ? "+" : ""}${Math.round(((d.entries7 - d.entriesPrev7) / d.entriesPrev7) * 100)}% vs the week before`;
  const sent = (d.messages.SENT ?? 0) + (d.messages.DELIVERED ?? 0) + (d.messages.READ ?? 0);
  return (
    <>
      <PageHeader title="Platform overview" sub="How many shops and people use the app, and what they are doing. Counts only; no customer or money details are shown here." />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon="shop" label="Shops" value={String(d.shops)} hint={`${d.shopsNew7} new this week · ${d.shopsNew30} this month`} href="/platform/shops" />
        <StatCard icon="users" label="People" value={String(d.users)} hint={`${d.usersNew7} joined this week`} href="/platform/users" />
        <StatCard icon="trend" label="Active shops (7 days)" value={String(d.active.week.shops)} tone="got" hint={`${d.active.day.shops} today · ${d.active.month.shops} in 30 days`} />
        <StatCard icon="clock" label="Active people (7 days)" value={String(d.active.week.users)} hint={`${d.active.day.users} today · ${d.active.month.users} in 30 days`} />
        <StatCard icon="note" label="Entries written (7 days)" value={String(d.entries7)} hint={trend} />
        <StatCard icon="bill" label="Bills made (7 days)" value={String(d.bills7)} />
        <StatCard icon="send" label="Messages sent (7 days)" value={String(sent)} hint={`${d.messages.FAILED ?? 0} failed · ${d.messages.SKIPPED ?? 0} skipped`} tone={(d.messages.FAILED ?? 0) > 0 ? "gave" : undefined} />
        <StatCard icon="card" label="Online payments (7 days)" value={formatINR(d.pay7.paise)} hint={`${d.pay7.count} payment${d.pay7.count === 1 ? "" : "s"} · ${d.paySuccess} ever`} />
      </div>

      <SectionTitle>Last 14 days</SectionTitle>
      <Card className="grid gap-6 sm:grid-cols-3">
        <Bars series={d.signups} label="New shops" />
        <Bars series={d.entriesSeries} label="Entries written" tone="got" />
        <Bars series={d.billsSeries} label="Bills made" tone="warn" />
      </Card>

      <SectionTitle>How far new shops get</SectionTitle>
      <Card>
        <ol className="space-y-3">
          {[
            ["Created a shop", d.funnel.shops],
            ["Added a customer", d.funnel.customer],
            ["Made a bill", d.funnel.bill],
            ["Sent a message", d.funnel.message],
          ].map(([label, n]) => (
            <li key={label as string}>
              <div className="mb-1 flex justify-between text-sm"><span>{label}</span><span className="tabular-nums text-muted">{n} · {pct(n as number, d.funnel.shops)}</span></div>
              <div className="h-2 overflow-hidden rounded-full bg-line"><div className="h-full rounded-full bg-brand" style={{ width: d.funnel.shops ? `${((n as number) / d.funnel.shops) * 100}%` : "0%" }} /></div>
            </li>
          ))}
        </ol>
      </Card>
    </>
  );
}
