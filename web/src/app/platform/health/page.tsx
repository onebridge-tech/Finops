import { health } from "@/lib/platform-insights";
import { Badge, Card, PageHeader, SectionTitle } from "@/components/ui";
import { since } from "../bars";

export const metadata = { title: "Health · Platform admin" };
export const dynamic = "force-dynamic";

const size = (b: number) => (b > 1e9 ? `${(b / 1e9).toFixed(2)} GB` : `${(b / 1e6).toFixed(1)} MB`);
const every = (ms: number) => (ms >= 86_400_000 ? "every day" : "every hour");

export default async function Health() {
  const h = await health();
  return (
    <>
      <PageHeader title="Health" sub="Is the background work running, are messages getting through, and what is switched on." />

      <SectionTitle>Background jobs</SectionTitle>
      <Card className="divide-y divide-line p-0 sm:p-0">
        {h.jobs.map((j) => (
          <div key={j.name} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
            <span>
              <span className="block font-medium">{j.label}</span>
              <span className="block text-xs text-muted">Should run {every(j.every)}. {j.schedulerOn ? "Built-in scheduler is on." : `Built-in scheduler is off (${j.flag} is not 1); it only runs if something calls its cron address.`}</span>
              {j.last && !j.last.ok && j.last.finishedAt && <span className="mt-1 block text-xs text-gave">Last run failed: {j.last.error}</span>}
            </span>
            <span className="sm:text-right">
              {j.lastOk ? <Badge tone={j.late ? "warn" : "good"}>{j.late ? "Late" : "Running"}</Badge> : <Badge tone="bad">Never ran</Badge>}
              <span className="mt-1 block text-xs text-muted">{j.lastOk ? `Last success ${since(j.lastOk.startedAt)}` : "No successful run recorded"}</span>
            </span>
          </div>
        ))}
      </Card>
      <p className="mt-2 text-xs text-muted">On a free Render service the app sleeps when idle, so the built-in scheduler can miss hours. Use Render’s cron job (or a ping service) to call <code>/api/cron/reminders</code> hourly with the cron secret.</p>

      <SectionTitle>Messages (last 7 days)</SectionTitle>
      <div className="grid gap-3 sm:grid-cols-3">
        {h.channels.map((c) => (
          <Card key={c.channel}>
            <div className="flex items-center justify-between">
              <p className="font-medium">{c.channel === "WHATSAPP" ? "WhatsApp" : c.channel === "SMS" ? "SMS" : "Email"}</p>
              <Badge tone={c.test ? "warn" : "good"}>{c.test ? "Test mode" : `Live · ${c.provider}`}</Badge>
            </div>
            <p className="mt-2 text-2xl font-semibold tabular-nums">{c.rate === null ? "—" : `${c.rate}%`}</p>
            <p className="text-xs text-muted">{c.ok} sent · {c.failed} failed · {c.skipped} skipped</p>
          </Card>
        ))}
      </div>

      <SectionTitle>What is switched on</SectionTitle>
      <Card className="divide-y divide-line p-0 sm:p-0">
        {h.integrations.map((i) => (
          <div key={i.name} className="flex items-center justify-between gap-3 px-4 py-2.5">
            <span>{i.name}</span>
            <Badge tone={"warn" in i && i.warn ? "bad" : i.live ? "good" : "neutral"}>{i.state}</Badge>
          </div>
        ))}
      </Card>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section>
          <SectionTitle>Database</SectionTitle>
          <Card className="divide-y divide-line p-0 sm:p-0">
            <div className="flex justify-between px-4 py-2.5"><span>Size</span><span className="font-semibold tabular-nums">{size(h.database.bytes)}</span></div>
            <div className="flex justify-between px-4 py-2.5"><span>People signed in right now (sessions)</span><span className="tabular-nums">{h.database.sessions}</span></div>
            {h.database.tables.map((t) => <div key={t.name} className="flex justify-between px-4 py-2.5"><span className="text-muted">{t.name}</span><span className="tabular-nums">{t.count.toLocaleString("en-IN")}</span></div>)}
          </Card>
        </section>
        <section>
          <SectionTitle>This server</SectionTitle>
          <Card className="divide-y divide-line p-0 sm:p-0">
            {[
              ["Version", h.build.commit ?? "unknown"], ["Service", h.build.service ?? "—"], ["Running for", `${h.build.uptimeMin} min`], ["Node", h.build.node], ["Mode", h.build.env ?? "—"],
            ].map(([k, v]) => <div key={k} className="flex justify-between px-4 py-2.5"><span className="text-muted">{k}</span><span className="font-mono text-xs">{v}</span></div>)}
          </Card>
        </section>
      </div>
    </>
  );
}
