import Link from "next/link";
import { requireBusiness, partyWhere } from "@/lib/auth";
import { db } from "@/lib/db";
import { archiveBeat } from "@/app/actions/field";
import { Card, PageHeader, buttonClass } from "@/components/ui";
import { BeatForm } from "./beat-form";
import { userLabel } from "@/lib/identity";

export const metadata = { title: "Daily routes" };
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default async function Beats() {
  const ctx = await requireBusiness("field:manage");
  const [beats, members, parties] = await Promise.all([
    db.beat.findMany({ where: { businessId: ctx.business.id, archivedAt: null }, include: { parties: { orderBy: { position: "asc" } } }, orderBy: { name: "asc" } }),
    db.membership.findMany({ where: { businessId: ctx.business.id }, include: { user: true } }),
    db.party.findMany({ where: { ...partyWhere(ctx), archivedAt: null, type: { not: "SUPPLIER" } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const who = (id: string) => members.find((m) => m.userId === id)?.user;
  const pn = new Map(parties.map((p) => [p.id, p.name]));
  const people = members.map((m) => ({ id: m.userId, name: userLabel(m.user) }));
  return (
    <>
      <PageHeader title="Daily routes" sub="A route is the list of customers a salesman visits on certain days." action={<Link href="/field/team" className="text-sm text-brand underline">Staff & targets</Link>} />
      <div className="space-y-3">
        {beats.length === 0 && <Card className="text-sm text-muted">No routes yet. Make one below.</Card>}
        {beats.map((b) => (
          <Card key={b.id} className="space-y-1 text-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium">{b.name} <span className="font-normal text-muted">· {userLabel(who(b.userId))} · {b.weekdays.split(",").map((d) => DAYS[Number(d)]).join(", ")}</span></p>
                <p className="text-muted">{b.parties.map((p, i) => `${i + 1}. ${pn.get(p.partyId) ?? "—"}`).join("  ·  ") || "No customers"}</p>
              </div>
              <form action={archiveBeat}><input type="hidden" name="id" value={b.id} /><button className={buttonClass("secondary")}>Remove</button></form>
            </div>
            <details className="pt-2">
              <summary className="cursor-pointer text-brand">Edit</summary>
              <div className="pt-2"><BeatForm people={people} parties={parties} beat={{ id: b.id, name: b.name, userId: b.userId, weekdays: b.weekdays, partyIds: b.parties.map((p) => p.partyId) }} /></div>
            </details>
          </Card>
        ))}
        <h2 className="pt-2 font-semibold">New route</h2>
        <Card><BeatForm people={people} parties={parties} /></Card>
      </div>
    </>
  );
}
