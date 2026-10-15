"use server";

import { after } from "next/server";
import { db } from "@/lib/db";
import { newShareToken } from "@/lib/session";
import { normalizeIndianMobile } from "@/lib/share";
import { createOrderRecord } from "@/lib/orders";
import { sendToOwner } from "@/lib/messaging/send";
import { formatINR } from "@/lib/money";
import type { Channel } from "@/lib/reminder-rule";

export type CatalogueOrderState = { error?: string; ok?: boolean; number?: string };

const field = (f: FormData, k: string) => String(f.get(k) ?? "");

/**
 * An order request from the public catalogue (CI-02). No login: the buyer's
 * name and mobile are the only identity, so it lands as a REQUEST the owner
 * must accept, with the buyer saved as a lead. Rate-limited per mobile number
 * and per business.
 */
export async function placeCatalogueOrder(_prev: CatalogueOrderState, form: FormData): Promise<CatalogueOrderState> {
  if (field(form, "website")) return { ok: true, number: "—" }; // honeypot: bots fill every field
  const business = await db.business.findFirst({ where: { catalogToken: field(form, "token"), catalogEnabled: true, suspendedAt: null } });
  if (!business) return { error: "This catalogue is not available." };

  const name = field(form, "name").trim().slice(0, 80);
  const phone = normalizeIndianMobile(field(form, "phone"));
  if (name.length < 2) return { error: "Enter your name" };
  if (!phone) return { error: "Enter a valid 10-digit mobile number" };

  let picks: { itemId: string; qty: number }[];
  try {
    const raw = JSON.parse(field(form, "lines")) as { itemId: string; qty: number }[];
    picks = raw.filter((l) => typeof l.itemId === "string" && Number.isFinite(l.qty) && l.qty > 0 && l.qty <= 100000).slice(0, 40);
  } catch {
    return { error: "Invalid order" };
  }
  if (picks.length === 0) return { error: "Choose at least one item" };

  const hourAgo = new Date(Date.now() - 3600_000);
  const dayAgo = new Date(Date.now() - 86400_000);
  const existing = await db.party.findFirst({ where: { businessId: business.id, phone, archivedAt: null } });
  const [byPhone, byBusiness] = await Promise.all([
    existing ? db.order.count({ where: { businessId: business.id, partyId: existing.id, source: "CATALOGUE", createdAt: { gte: hourAgo } } }) : 0,
    db.order.count({ where: { businessId: business.id, source: "CATALOGUE", createdAt: { gte: dayAgo } } }),
  ]);
  if (byPhone >= 5) return { error: "You have sent several orders just now. Please wait a while or call the shop." };
  if (byBusiness >= 200) return { error: "This shop is receiving a lot of requests right now. Please call them instead." };

  const items = await db.item.findMany({ where: { id: { in: picks.map((p) => p.itemId) }, businessId: business.id, isPublic: true, archivedAt: null } });
  const byId = new Map(items.map((i) => [i.id, i]));
  if (picks.some((p) => !byId.has(p.itemId))) return { error: "Some items are no longer available. Please reload the catalogue." };

  const order = await db.$transaction(async (tx) => {
    const party = existing ?? (await tx.party.create({
      data: { businessId: business.id, name, type: "LEAD", phone, source: "Catalogue", shareToken: newShareToken(), stateCode: business.stateCode },
    }));
    return createOrderRecord(tx, {
      businessId: business.id, branchId: null, kind: "SALES", partyId: party.id, date: new Date(), expectedDate: null,
      placeOfSupply: party.stateCode ?? business.stateCode, sellerStateCode: business.stateCode,
      notes: `From catalogue — ${name}, ${phone}${field(form, "note").trim() ? ": " + field(form, "note").trim().slice(0, 300) : ""}`,
      status: "REQUEST", source: "CATALOGUE", userId: null,
      lines: picks.map((p) => {
        const i = byId.get(p.itemId)!;
        return { itemId: i.id, description: i.variantName ? `${i.name} — ${i.variantName}` : i.name, hsn: i.hsn, qtyMilli: Math.round(p.qty * 1000), unit: i.unit, ratePaise: Number(i.pricePaise), taxRateBp: i.taxRateBp, discountBp: 0 };
      }),
    });
  });

  after(async () => {
    const owner = await db.membership.findFirst({ where: { businessId: business.id, role: "OWNER" }, orderBy: { createdAt: "asc" }, include: { user: true } });
    if (!owner) return;
    await sendToOwner({
      business, to: { phone: owner.user.phone, email: business.email }, channel: business.reminderChannel as Channel, kind: "ALERT",
      subject: `New catalogue order · ${business.name}`, body: `New catalogue order ${order.number} from ${name} (${phone}) for ${formatINR(order.totalPaise)}. Open Orders → Requests to accept it.`, userId: owner.userId,
    }).catch(() => undefined);
  });
  return { ok: true, number: order.number };
}
