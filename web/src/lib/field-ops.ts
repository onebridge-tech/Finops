import "server-only";
import { after } from "next/server";
import { db } from "./db";
import { audit } from "./audit";
import { findParty, can, type Ctx } from "./auth";
import { distanceMeters, priceFor } from "./rules";
import { issueReceipt } from "./receipts";
import { createOrderRecord } from "./orders";
import { sellerFor } from "./doc-core";
import { parseRupees } from "./money";
import { sendToParty } from "./messaging/send";
import { appUrl } from "./share";
import { balanceOf, istDay } from "./ledger";
import { fmtDate, PAYMENT_MODES } from "./format";
import type { Channel } from "./reminder-rule";

// Operations a field rep does on a visit (FS-01, FS-02, FS-07). Each one takes a
// client-generated id, so a phone that retries an upload after a dropped
// connection never creates a second visit, order or receipt (FS-08).

export type FieldOp =
  | { kind: "DAYSTART"; clientId: string; at: string; lat?: number; lng?: number }
  | { kind: "CHECKIN"; clientId: string; partyId: string; at: string; lat?: number; lng?: number; accuracy?: number }
  | { kind: "CHECKOUT"; clientId: string; visitClientId: string; at: string; note?: string; outcome?: string; lat?: number; lng?: number }
  | { kind: "ORDER"; clientId: string; partyId: string; visitClientId?: string; note?: string; lines: { itemId: string; qty: number }[] }
  | { kind: "COLLECTION"; clientId: string; partyId: string; amount: string; mode: string; note?: string; at: string };

export type OpResult = { clientId: string; ok: boolean; error?: string; refId?: string; info?: string };

const when = (iso: string) => {
  const d = new Date(iso);
  // A phone clock that is wildly wrong shouldn't backdate or post-date records.
  return Number.isNaN(d.getTime()) || Math.abs(d.getTime() - Date.now()) > 3 * 86400_000 ? new Date() : d;
};
const coord = (n: unknown, max: number) => (typeof n === "number" && Number.isFinite(n) && Math.abs(n) <= max ? n : undefined);

/** Records that a client operation has been handled; returns the earlier result if it was. */
async function seen(ctx: Ctx, clientId: string) {
  return db.clientOp.findUnique({ where: { clientId } });
}

async function markAttendance(ctx: Ctx, at: Date, source: "DAYSTART" | "VISIT", lat?: number, lng?: number) {
  const date = istDay(at);
  const exists = await db.attendance.findUnique({ where: { businessId_userId_date: { businessId: ctx.business.id, userId: ctx.user.id, date } } });
  if (exists) return exists;
  return db.attendance.create({ data: { businessId: ctx.business.id, userId: ctx.user.id, date, checkInAt: at, lat: lat ?? null, lng: lng ?? null, source } });
}

export async function applyOp(ctx: Ctx, op: FieldOp): Promise<OpResult> {
  const { clientId } = op;
  if (typeof clientId !== "string" || clientId.length < 8 || clientId.length > 80) return { clientId: String(clientId), ok: false, error: "Bad operation id" };
  const done = await seen(ctx, clientId);
  if (done) return { clientId, ok: true, refId: done.refId ?? undefined, info: "already processed" };
  try {
    const refId = await run(ctx, op);
    await db.clientOp.create({ data: { businessId: ctx.business.id, userId: ctx.user.id, clientId, kind: op.kind, refId } });
    return { clientId, ok: true, refId: refId ?? undefined };
  } catch (e) {
    return { clientId, ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}

async function run(ctx: Ctx, op: FieldOp): Promise<string | null> {
  if (!can(ctx.role, "ledger:write")) throw new Error("You can't record visits");
  switch (op.kind) {
    case "DAYSTART": {
      const a = await markAttendance(ctx, when(op.at), "DAYSTART", coord(op.lat, 90), coord(op.lng, 180));
      return a.id;
    }
    case "CHECKIN": {
      const party = await findParty(ctx, op.partyId);
      if (!party) throw new Error("Party not found");
      const at = when(op.at);
      const lat = coord(op.lat, 90);
      const lng = coord(op.lng, 180);
      const here = lat !== undefined && lng !== undefined ? { lat, lng } : null;
      const saved = party.lat !== null && party.lng !== null ? { lat: party.lat, lng: party.lng } : null;
      const distanceM = here && saved ? distanceMeters(here, saved) : null;
      const visit = await db.$transaction(async (tx) => {
        // The first visit with a location teaches the app where the customer is.
        if (here && !saved) await tx.party.update({ where: { id: party.id }, data: { lat: here.lat, lng: here.lng } });
        const v = await tx.visit.create({
          data: {
            businessId: ctx.business.id, branchId: ctx.branchId ?? party.branchId, partyId: party.id, userId: ctx.user.id, clientId: op.clientId,
            checkInAt: at, inLat: lat ?? null, inLng: lng ?? null, inAccuracy: coord(op.accuracy, 100000) ?? null, distanceM,
          },
        });
        await audit(tx, { businessId: ctx.business.id, actorId: ctx.user.id, action: "check_in", entity: "Visit", entityId: v.id, data: { partyId: party.id, distanceM } });
        return v;
      });
      await markAttendance(ctx, at, "VISIT", lat, lng);
      return visit.id;
    }
    case "CHECKOUT": {
      const v = await db.visit.findFirst({ where: { clientId: op.visitClientId, businessId: ctx.business.id, userId: ctx.user.id } });
      if (!v) throw new Error("Visit not found");
      if (v.checkOutAt) return v.id;
      await db.visit.update({
        where: { id: v.id },
        data: { checkOutAt: when(op.at), note: op.note?.trim().slice(0, 300) || null, outcome: op.outcome?.trim().slice(0, 60) || null, outLat: coord(op.lat, 90) ?? null, outLng: coord(op.lng, 180) ?? null },
      });
      return v.id;
    }
    case "COLLECTION": {
      const party = await findParty(ctx, op.partyId);
      if (!party) throw new Error("Party not found");
      const amount = parseRupees(op.amount);
      if (!amount) throw new Error("Enter an amount greater than zero");
      if (!(PAYMENT_MODES as readonly string[]).includes(op.mode)) throw new Error("Choose how it was paid");
      const at = when(op.at);
      const date = new Date(`${istDay(at)}T12:00:00+05:30`);
      const { entry, receipt } = await db.$transaction(async (tx) => {
        const e = await tx.ledgerEntry.create({
          data: {
            businessId: ctx.business.id, partyId: party.id, branchId: ctx.branchId ?? party.branchId, direction: "GOT", amountPaise: BigInt(amount), date,
            note: op.note?.trim().slice(0, 200) || "Collected on visit", paymentMode: op.mode, createdById: ctx.user.id,
          },
        });
        const rc = await issueReceipt(tx, ctx.business.id, e);
        await audit(tx, { businessId: ctx.business.id, actorId: ctx.user.id, action: "create", entity: "LedgerEntry", entityId: e.id, data: { ...e, via: "field" } });
        return { entry: e, receipt: rc };
      });
      if (ctx.business.autoReceipt) {
        after(async () => {
          const bal = balanceOf(await db.ledgerEntry.findMany({ where: { partyId: party.id } }));
          await sendToParty({
            business: ctx.business, party, kind: "RECEIPT", channel: ctx.business.reminderChannel as Channel, userId: ctx.user.id, trigger: "AUTO",
            vars: { amountPaise: amount, number: receipt.number, date: fmtDate(entry.date), balancePaise: bal, link: appUrl(`/r/${receipt.shareToken}`) },
          }).catch(() => undefined);
        });
      }
      return entry.id;
    }
    case "ORDER": {
      const party = await findParty(ctx, op.partyId);
      if (!party) throw new Error("Party not found");
      if (!Array.isArray(op.lines) || op.lines.length === 0 || op.lines.length > 60) throw new Error("Add at least one item");
      const items = await db.item.findMany({ where: { id: { in: op.lines.map((l) => l.itemId) }, businessId: ctx.business.id, archivedAt: null } });
      const byId = new Map(items.map((i) => [i.id, i]));
      // Rates come from the server's price list for this party, not from the phone.
      const rows = party.priceListId ? await db.priceListItem.findMany({ where: { priceListId: party.priceListId, itemId: { in: items.map((i) => i.id) } } }) : [];
      const priceRows = rows.map((r) => ({ itemId: r.itemId, minQtyMilli: r.minQtyMilli, ratePaise: Number(r.ratePaise) }));
      const visit = op.visitClientId ? await db.visit.findFirst({ where: { clientId: op.visitClientId, businessId: ctx.business.id, userId: ctx.user.id } }) : null;
      const lines = op.lines.map((l) => {
        const i = byId.get(l.itemId);
        if (!i) throw new Error("An item is no longer available");
        if (!Number.isFinite(l.qty) || l.qty <= 0 || l.qty > 100000) throw new Error("Quantities must be more than zero");
        const qtyMilli = Math.round(l.qty * 1000);
        return {
          itemId: i.id, description: i.variantName ? `${i.name} — ${i.variantName}` : i.name, hsn: i.hsn, qtyMilli, unit: i.unit,
          ratePaise: priceFor(priceRows, i.id, qtyMilli, Number(i.pricePaise)), taxRateBp: i.taxRateBp, discountBp: 0,
        };
      });
      const branchId = ctx.branchId ?? party.branchId;
      const seller = await sellerFor(db, ctx.business.id, branchId);
      const order = await db.$transaction((tx) =>
        createOrderRecord(tx, {
          businessId: ctx.business.id, branchId, kind: "SALES", partyId: party.id, date: new Date(), expectedDate: null, placeOfSupply: party.stateCode ?? ctx.business.stateCode,
          sellerStateCode: seller.stateCode, notes: op.note?.trim().slice(0, 300) || null, source: "VISIT", visitId: visit?.id, userId: ctx.user.id, lines,
        }),
      );
      return order.id;
    }
  }
}
