import Link from "next/link";
import { requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import { istDay } from "@/lib/ledger";
import { formatINR } from "@/lib/money";
import { fmtDate } from "@/lib/format";
import { liveVisits, teamProgress, attendanceRows, METRIC_LABEL, isMoney } from "@/lib/field-team";
import { Card, PageHeader } from "@/components/ui";
import { TargetForm } from "./target-form";

export const metadata = { title: "Staff & targets" };

const time = (d: Date) => d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" });

export default async function Team() {
  const ctx = await requireBusiness("field:manage");
  const today = istDay(new Date());
  const month = today.slice(0, 7);
  const [live, progress, att, members] = await Promise.all([
    liveVisits(ctx, today),
    teamProgress(ctx, month, today),
    attendanceRows(ctx, today, today),
    db.membership.findMany({ where: { businessId: ctx.business.id }, include: { user: true } }),
  ]);
  const fmt = (m: string, n: number) => (isMoney(m) ? formatINR(n) : String(n));
  const names = members.map((m) => ({ id: m.userId, name: m.user.name ?? `+${m.user.phone}` }));
  return (
    <>
      <PageHeader title="Staff & targets" sub={`Live view for ${fmtDate(new Date())}`} action={<Link href="/field/beats" className="text-sm text-brand underline">Daily routes</Link>} />
      <section className="mb-6">
        <h2 className="mb-2 font-semibold">Attendance today</h2>
        <Card className="divide-y divide-line p-0 text-sm">
          {att.length === 0 && <p className="px-4 py-3 text-muted">Nobody has started their day yet.</p>}
          {att.map((a) => <div key={a.rep} className="flex justify-between px-4 py-2"><span>{a.rep}</span><span className="text-muted">{time(a.at)} · {a.source === "DAYSTART" ? "started day" : "first visit"}{a.hasPhoto && " · selfie"}</span></div>)}
        </Card>
        <p className="mt-1 text-xs"><Link className="text-brand underline" href="/reports/attendance">Attendance report and payroll export</Link> · <Link className="text-brand underline" href="/reports/missed">Missed visits</Link></p>
      </section>
      <section className="mb-6">
        <h2 className="mb-2 font-semibold">Visits today</h2>
        <Card className="divide-y divide-line p-0 text-sm">
          {live.length === 0 && <p className="px-4 py-3 text-muted">No visits yet today.</p>}
          {live.map((v) => (
            <div key={v.id} className="flex flex-wrap justify-between gap-2 px-4 py-2">
              <span>{v.rep} → {v.party}<span className="block text-xs text-muted">{time(v.at)}{v.out ? ` – ${time(v.out)}` : " · still there"}{v.outcome && ` · ${v.outcome}`}</span></span>
              {v.distanceM !== null && <span className={`text-xs ${v.distanceM > 200 ? "font-semibold text-gave" : "text-muted"}`}>{v.distanceM > 200 ? "⚠ " : ""}{v.distanceM} m from the customer’s saved location</span>}
            </div>
          ))}
        </Card>
      </section>
      <section className="mb-6">
        <h2 className="mb-2 font-semibold">Targets — {month}</h2>
        <Card className="mb-3 overflow-x-auto p-0 text-sm">
          <table className="w-full">
            <thead className="text-left text-xs text-muted"><tr><th className="px-4 py-2">Salesman</th><th>Measure</th><th className="text-right">So far</th><th className="text-right">Should be done by today</th><th className="px-4 text-right">Month target</th></tr></thead>
            <tbody className="divide-y divide-line">
              {progress.filter((p) => p.target !== null || p.actual > 0).map((p) => {
                const behind = p.expected !== null && p.actual < p.expected;
                return (
                  <tr key={p.userId + p.metric}>
                    <td className="px-4 py-2">{p.name}</td><td>{METRIC_LABEL[p.metric]}</td>
                    <td className={`text-right ${behind ? "text-gave" : "text-got"}`}>{fmt(p.metric, p.actual)}</td>
                    <td className="text-right text-muted">{p.expected === null ? "—" : fmt(p.metric, p.expected)}</td>
                    <td className="px-4 text-right">{p.target === null ? "—" : fmt(p.metric, p.target)}</td>
                  </tr>
                );
              })}
              {progress.length === 0 && <tr><td className="px-4 py-3 text-muted" colSpan={5}>Set a target below to track it here.</td></tr>}
            </tbody>
          </table>
        </Card>
        <TargetForm month={month} members={names} />
      </section>
    </>
  );
}
