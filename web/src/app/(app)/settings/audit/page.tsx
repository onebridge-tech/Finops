import Link from "next/link";
import { requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import { verifyAudit } from "@/lib/audit";
import { Card, PageHeader, Select, fmtDate } from "@/components/ui";

export const metadata = { title: "Audit trail" };

const PAGE = 50;

/** Field-level before → after for update events; the raw record otherwise. */
function Changes({ data }: { data: string | null }) {
  if (!data) return null;
  let parsed: unknown;
  try { parsed = JSON.parse(data); } catch { return <pre className="whitespace-pre-wrap text-xs text-muted">{data}</pre>; }
  const d = parsed as { before?: Record<string, unknown>; after?: Record<string, unknown> };
  if (d && typeof d === "object" && d.before && d.after) {
    const keys = Object.keys(d.after).filter((k) => JSON.stringify(d.before![k]) !== JSON.stringify(d.after![k]));
    if (keys.length === 0) return <p className="text-xs text-muted">No field changed</p>;
    return (
      <ul className="text-xs">
        {keys.map((k) => (
          <li key={k}><span className="text-muted">{k}:</span> <span className="line-through">{String(d.before![k] ?? "—")}</span> → <span className="font-medium">{String(d.after![k] ?? "—")}</span></li>
        ))}
      </ul>
    );
  }
  return (
    <details className="text-xs">
      <summary className="cursor-pointer text-muted">Details</summary>
      <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap rounded bg-bg p-2">{JSON.stringify(parsed, null, 2)}</pre>
    </details>
  );
}

export default async function Audit({ searchParams }: PageProps<"/settings/audit">) {
  const sp = await searchParams;
  const ctx = await requireBusiness("reports:view");
  const entity = typeof sp.entity === "string" ? sp.entity : "";
  const actor = typeof sp.actor === "string" ? sp.actor : "";
  const before = Number(sp.before) || undefined;

  const where = { businessId: ctx.business.id, ...(entity ? { entity } : {}), ...(actor ? { actorId: actor } : {}) };
  const [events, entities, members, check, legacy] = await Promise.all([
    db.auditEvent.findMany({
      where: { ...where, ...(before ? { seq: { lt: before } } : {}) },
      orderBy: [{ seq: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
      take: PAGE,
    }),
    db.auditEvent.groupBy({ by: ["entity"], where: { businessId: ctx.business.id } }),
    db.membership.findMany({ where: { businessId: ctx.business.id }, include: { user: true } }),
    verifyAudit(ctx.business.id),
    db.auditEvent.count({ where: { businessId: ctx.business.id, seq: null } }),
  ]);
  const who = new Map(members.map((m) => [m.userId, m.user.name ?? `+${m.user.phone}`]));
  const time = (d: Date) => d.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" });
  const last = events.at(-1)?.seq;

  return (
    <>
      <PageHeader title="Audit trail" sub="Every change to money records, parties, items and settings: who, when and what. It can’t be switched off or edited." />
      <Card className={`mb-4 text-sm ${check.ok ? "border-got/40 bg-got/5" : "border-gave/40 bg-gave/5"}`}>
        {check.ok
          ? <>✓ Integrity verified: all {check.checked} recorded events are intact and in order.</>
          : <>⚠ Integrity check failed: {check.reason}. The history may have been tampered with outside the app.</>}
        {legacy > 0 && <span className="block text-xs text-muted">{legacy} earlier events were recorded before tamper-evidence was added and can’t be verified.</span>}
      </Card>

      <form className="mb-4 flex flex-wrap gap-2 text-sm">
        <Select name="entity" defaultValue={entity} className="w-auto">
          <option value="">All records</option>
          {entities.map((e) => <option key={e.entity} value={e.entity}>{e.entity}</option>)}
        </Select>
        <Select name="actor" defaultValue={actor} className="w-auto">
          <option value="">Everyone</option>
          {members.map((m) => <option key={m.userId} value={m.userId}>{who.get(m.userId)}</option>)}
        </Select>
        <button className="rounded-lg border border-line bg-card px-3 py-1.5 font-medium hover:bg-bg">Filter</button>
      </form>

      <Card className="divide-y divide-line p-0 text-sm">
        {events.length === 0 && <p className="px-4 py-3 text-muted">No events.</p>}
        {events.map((e) => (
          <div key={e.id} className="grid gap-1 px-4 py-3 sm:grid-cols-[10rem_1fr]">
            <span className="text-xs text-muted">
              {fmtDate(e.createdAt)} {time(e.createdAt)}
              <span className="block">{e.seq ? `#${e.seq}` : "unchained"}</span>
            </span>
            <span>
              <span className="font-medium">{who.get(e.actorId) ?? "Former member"}</span> {e.action.replace(/_/g, " ")} <span className="text-muted">{e.entity}</span>
              <Changes data={e.data} />
            </span>
          </div>
        ))}
      </Card>
      {events.length === PAGE && last && (
        <Link href={`/settings/audit?${new URLSearchParams({ ...(entity && { entity }), ...(actor && { actor }), before: String(last) })}`} className="mt-3 inline-block text-sm text-brand underline">Older events</Link>
      )}
    </>
  );
}
