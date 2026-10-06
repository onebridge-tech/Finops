import "server-only";
import { db } from "./db";
import { partyWhere, type Ctx } from "./auth";
import { istDay } from "./ledger";
import { beatRunsOn } from "./rules";
import { partiesWithBalance } from "./queries";

const weekdayOf = (ymd: string) => new Date(`${ymd}T12:00:00+05:30`).getUTCDay();

export type FieldParty = {
  id: string; name: string; phone: string | null; address: string | null; balance: number; lat: number | null; lng: number | null;
  priceListId: string | null; planned: boolean;
};

export type FieldDay = {
  today: string;
  attendance: { at: string } | null;
  openVisit: { id: string; clientId: string | null; partyId: string; partyName: string; since: string } | null;
  plan: { beat: string; partyId: string; visited: { at: string } | null }[];
  parties: FieldParty[];
  items: { id: string; name: string; unit: string; ratePaise: number; taxRateBp: number }[];
  priceRows: Record<string, { itemId: string; minQtyMilli: number; ratePaise: number }[]>;
  todayVisits: { id: string; partyName: string; at: string; out: string | null; distanceM: number | null; outcome: string | null }[];
};

/** Everything the rep's screen (and its offline copy) needs for today (FS-01, FS-04, FS-08). */
export async function fieldDay(ctx: Ctx): Promise<FieldDay> {
  const today = istDay(new Date());
  const dayStart = new Date(`${today}T00:00:00+05:30`);
  const [parties, beats, visits, attendance, items] = await Promise.all([
    partiesWithBalance(ctx),
    db.beat.findMany({ where: { businessId: ctx.business.id, userId: ctx.user.id, archivedAt: null }, include: { parties: { orderBy: { position: "asc" } } } }),
    db.visit.findMany({ where: { businessId: ctx.business.id, userId: ctx.user.id, checkInAt: { gte: dayStart } }, orderBy: { checkInAt: "desc" } }),
    db.attendance.findUnique({ where: { businessId_userId_date: { businessId: ctx.business.id, userId: ctx.user.id, date: today } } }),
    db.item.findMany({ where: { businessId: ctx.business.id, archivedAt: null }, orderBy: [{ name: "asc" }, { variantName: "asc" }] }),
  ]);
  const pn = new Map(parties.map((p) => [p.id, p]));
  const running = beats.filter((b) => beatRunsOn(b.weekdays, weekdayOf(today)));
  const plan = running.flatMap((b) => b.parties.filter((bp) => pn.has(bp.partyId)).map((bp) => {
    const v = visits.find((x) => x.partyId === bp.partyId);
    return { beat: b.name, partyId: bp.partyId, visited: v ? { at: v.checkInAt.toISOString() } : null };
  }));
  const planned = new Set(plan.map((p) => p.partyId));
  const open = visits.find((v) => !v.checkOutAt);

  const listIds = [...new Set(parties.map((p) => p.priceListId).filter((x): x is string => !!x))];
  const rows = listIds.length ? await db.priceListItem.findMany({ where: { priceListId: { in: listIds }, priceList: { archivedAt: null } } }) : [];
  const priceRows: FieldDay["priceRows"] = {};
  for (const r of rows) (priceRows[r.priceListId] ??= []).push({ itemId: r.itemId, minQtyMilli: r.minQtyMilli, ratePaise: Number(r.ratePaise) });

  return {
    today,
    attendance: attendance ? { at: attendance.checkInAt.toISOString() } : null,
    openVisit: open ? { id: open.id, clientId: open.clientId, partyId: open.partyId, partyName: pn.get(open.partyId)?.name ?? "—", since: open.checkInAt.toISOString() } : null,
    plan,
    parties: parties.filter((p) => p.type !== "SUPPLIER").map((p) => ({
      id: p.id, name: p.name, phone: p.phone, address: p.address, balance: p.balance, lat: p.lat, lng: p.lng, priceListId: p.priceListId, planned: planned.has(p.id),
    })),
    items: items.map((i) => ({ id: i.id, name: i.variantName ? `${i.name} — ${i.variantName}` : i.name, unit: i.unit, ratePaise: Number(i.pricePaise), taxRateBp: i.taxRateBp })),
    priceRows,
    todayVisits: visits.map((v) => ({ id: v.id, partyName: pn.get(v.partyId)?.name ?? "—", at: v.checkInAt.toISOString(), out: v.checkOutAt?.toISOString() ?? null, distanceM: v.distanceM, outcome: v.outcome })),
  };
}

export { partyWhere };
