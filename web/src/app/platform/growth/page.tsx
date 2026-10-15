import { growth } from "@/lib/platform-insights";
import { Card, PageHeader, SectionTitle } from "@/components/ui";

export const metadata = { title: "Growth · Platform admin" };
export const dynamic = "force-dynamic";

const pct = (n: number, d: number) => (d === 0 ? "—" : `${Math.round((n / d) * 100)}%`);
const shade = (v: number | null) => (v === null ? "" : v >= 60 ? "bg-got/25" : v >= 30 ? "bg-got/15" : v > 0 ? "bg-warn/15" : "bg-gave/10");
const day = (ymd: string) => new Date(`${ymd}T12:00:00+05:30`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", timeZone: "Asia/Kolkata" });

export default async function Growth() {
  const g = await growth();
  const max = Math.max(1, ...g.features.map((f) => f.shops));
  return (
    <>
      <PageHeader title="Growth" sub="Do new shops get started, do they come back, and which parts of the product do they use. Counts only." />

      <SectionTitle>New shops, week by week</SectionTitle>
      <Card className="overflow-x-auto p-0 sm:p-0">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="border-b border-line bg-bg/50 text-left text-xs font-medium text-muted">
            <tr><th className="px-4 py-2.5">Week of</th><th className="px-4 py-2.5 text-right">Joined</th><th className="px-4 py-2.5 text-right">Added a customer</th><th className="px-4 py-2.5 text-right">Made a bill</th><th className="px-4 py-2.5 text-right">Sent a message</th></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {g.cohorts.map((c) => (
              <tr key={c.week}>
                <td className="px-4 py-2.5">{day(c.week)}</td>
                <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{c.shops}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{c.customer} <span className="text-xs text-muted">{pct(c.customer, c.shops)}</span></td>
                <td className="px-4 py-2.5 text-right tabular-nums">{c.bill} <span className="text-xs text-muted">{pct(c.bill, c.shops)}</span></td>
                <td className="px-4 py-2.5 text-right tabular-nums">{c.message} <span className="text-xs text-muted">{pct(c.message, c.shops)}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <SectionTitle>Do they come back?</SectionTitle>
      <Card className="overflow-x-auto p-0 sm:p-0">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="border-b border-line bg-bg/50 text-left text-xs font-medium text-muted">
            <tr><th className="px-4 py-2.5">Joined in week of</th><th className="px-4 py-2.5 text-right">Shops</th>{["Same week", "Week 2", "Week 3", "Week 4", "Week 5"].map((h) => <th key={h} className="px-4 py-2.5 text-right">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-line">
            {g.cohorts.map((c) => (
              <tr key={c.week}>
                <td className="px-4 py-2.5">{day(c.week)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{c.shops}</td>
                {c.retention.map((r, i) => <td key={i} className={`px-4 py-2.5 text-right tabular-nums ${shade(r)}`}>{r === null ? "" : `${r}%`}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <p className="mt-2 text-xs text-muted">A shop counts as back in a week if it wrote an entry or made a bill that week.</p>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section>
          <SectionTitle>What shops use (last 30 days)</SectionTitle>
          <Card className="space-y-3">
            {g.features.map((f) => (
              <div key={f.label}>
                <div className="mb-1 flex justify-between text-sm"><span>{f.label}</span><span className="tabular-nums text-muted">{f.shops} of {g.total}</span></div>
                <div className="h-2 overflow-hidden rounded-full bg-line"><div className="h-full rounded-full bg-brand" style={{ width: `${(f.shops / max) * 100}%` }} /></div>
              </div>
            ))}
          </Card>
        </section>
        <section>
          <SectionTitle>How shops are set up</SectionTitle>
          <Card className="space-y-3">
            {g.setup.map((s) => (
              <div key={s.label}>
                <div className="mb-1 flex justify-between text-sm"><span>{s.label}</span><span className="tabular-nums text-muted">{s.n} of {g.total} · {pct(s.n, g.total)}</span></div>
                <div className="h-2 overflow-hidden rounded-full bg-line"><div className="h-full rounded-full bg-got" style={{ width: g.total ? `${(s.n / g.total) * 100}%` : "0%" }} /></div>
              </div>
            ))}
          </Card>
        </section>
      </div>
    </>
  );
}
