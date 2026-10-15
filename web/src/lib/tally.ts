import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { db } from "./db";
import { istDay, balanceOf } from "./ledger";
import { newShareToken } from "./session";
import { creditNoteVoucher, receiptVoucher, salesVoucher } from "./tally-xml";
import { audit } from "./audit";

// Tally connector (IN-01). A small agent on the Tally machine calls these functions
// through /api/tally/*: it fetches vouchers waiting to go in, reports what Tally
// said, and sends back ledgers, items and outstanding bills for us to compare.

const hash = (key: string) => createHash("sha256").update(key).digest("hex");

/** Makes a new connector key. Shown once; only its hash is stored. */
export async function rotateTallyKey(businessId: string, actorId: string): Promise<string> {
  const key = `blt_${randomBytes(24).toString("base64url")}`;
  await db.$transaction(async (tx) => {
    await tx.business.update({ where: { id: businessId }, data: { tallyKeyHash: hash(key) } });
    await audit(tx, { businessId, actorId, action: "tally_key_rotate", entity: "Business", entityId: businessId });
  });
  return key;
}

export async function revokeTallyKey(businessId: string, actorId: string) {
  await db.$transaction(async (tx) => {
    await tx.business.update({ where: { id: businessId }, data: { tallyKeyHash: null } });
    await audit(tx, { businessId, actorId, action: "tally_key_revoke", entity: "Business", entityId: businessId });
  });
}

/** The business a request's key belongs to, or null. */
export async function businessForKey(request: Request) {
  const m = /^Bearer\s+(blt_[A-Za-z0-9_-]{20,})$/.exec(request.headers.get("authorization") ?? "");
  if (!m) return null;
  const h = hash(m[1]!);
  const b = await db.business.findFirst({ where: { tallyKeyHash: h } });
  if (!b?.tallyKeyHash || b.suspendedAt) return null;
  const x = Buffer.from(b.tallyKeyHash);
  const y = Buffer.from(h);
  return x.length === y.length && timingSafeEqual(x, y) ? b : null;
}

export type Pending = { ref: string; kind: "INVOICE" | "RECEIPT" | "NOTE"; number: string; xml: string };
const MAX_RETRIES = 5;

async function alreadyDone(businessId: string, kind: string) {
  const logs = await db.tallySync.findMany({ where: { businessId, direction: "PUSH", kind: "VOUCHER", refType: kind } });
  return {
    ok: new Set(logs.filter((l) => l.status === "OK").map((l) => l.refId)),
    gaveUp: new Set(logs.filter((l) => l.status !== "OK" && l.retries >= MAX_RETRIES).map((l) => l.refId)),
  };
}

/** Invoices, receipts and credit notes that Tally has not accepted yet, oldest first. */
export async function pendingVouchers(businessId: string, limit = 25): Promise<Pending[]> {
  const out: Pending[] = [];
  const parties = new Map((await db.party.findMany({ where: { businessId }, select: { id: true, name: true } })).map((p) => [p.id, p.name]));

  const inv = await alreadyDone(businessId, "INVOICE");
  const invoices = await db.invoice.findMany({ where: { businessId, status: "ISSUED" }, orderBy: { createdAt: "asc" } });
  for (const i of invoices) {
    if (out.length >= limit) break;
    if (inv.ok.has(i.id) || inv.gaveUp.has(i.id)) continue;
    out.push({
      ref: `INVOICE:${i.id}`, kind: "INVOICE", number: i.number,
      xml: salesVoucher({
        number: i.number, date: istDay(i.date), party: parties.get(i.partyId) ?? "Unknown",
        taxablePaise: Number(i.taxablePaise), cgstPaise: Number(i.cgstPaise), sgstPaise: Number(i.sgstPaise), igstPaise: Number(i.igstPaise),
        roundOffPaise: Number(i.roundOffPaise), totalPaise: Number(i.totalPaise),
      }),
    });
  }

  const rc = await alreadyDone(businessId, "RECEIPT");
  const receipts = await db.receipt.findMany({ where: { businessId, entry: { reversedBy: null } }, include: { entry: true }, orderBy: { createdAt: "asc" } });
  for (const r of receipts) {
    if (out.length >= limit) break;
    if (rc.ok.has(r.entryId) || rc.gaveUp.has(r.entryId)) continue;
    out.push({
      ref: `RECEIPT:${r.entryId}`, kind: "RECEIPT", number: r.number,
      xml: receiptVoucher({ number: r.number, date: istDay(r.date), party: parties.get(r.partyId) ?? "Unknown", amountPaise: Number(r.amountPaise), mode: r.mode, note: r.entry.note }),
    });
  }

  const nt = await alreadyDone(businessId, "NOTE");
  const notes = await db.note.findMany({ where: { businessId, kind: "CREDIT", status: "ISSUED" }, orderBy: { createdAt: "asc" } });
  for (const n of notes) {
    if (out.length >= limit) break;
    if (nt.ok.has(n.id) || nt.gaveUp.has(n.id)) continue;
    out.push({
      ref: `NOTE:${n.id}`, kind: "NOTE", number: n.number,
      xml: creditNoteVoucher({
        number: n.number, date: istDay(n.date), party: parties.get(n.partyId) ?? "Unknown", reason: n.reason,
        taxablePaise: Number(n.taxablePaise), cgstPaise: Number(n.cgstPaise), sgstPaise: Number(n.sgstPaise), igstPaise: Number(n.igstPaise),
        roundOffPaise: Number(n.roundOffPaise), totalPaise: Number(n.totalPaise),
      }),
    });
  }
  return out;
}

export type Ack = { ref: string; ok: boolean; message?: string };

/** Records what Tally answered for each voucher. A failure is retried up to five times. */
export async function recordAcks(businessId: string, acks: Ack[]) {
  for (const a of acks.slice(0, 200)) {
    const [refType, refId] = String(a.ref).split(":");
    if (!refType || !refId || !["INVOICE", "RECEIPT", "NOTE"].includes(refType)) continue;
    const message = (a.message ?? "").slice(0, 300) || null;
    const prev = await db.tallySync.findFirst({ where: { businessId, direction: "PUSH", kind: "VOUCHER", refType, refId } });
    if (prev) {
      if (prev.status === "OK") continue;
      await db.tallySync.update({ where: { id: prev.id }, data: { status: a.ok ? "OK" : "FAILED", message, retries: a.ok ? prev.retries : prev.retries + 1, createdAt: new Date() } });
    } else {
      await db.tallySync.create({ data: { businessId, direction: "PUSH", kind: "VOUCHER", status: a.ok ? "OK" : "FAILED", refType, refId, message, retries: a.ok ? 0 : 1 } });
    }
  }
  await db.business.update({ where: { id: businessId }, data: { tallyLastSyncAt: new Date() } });
}

export type PullLedger = { name: string; parent?: string; gstin?: string; phone?: string };
export type PullItem = { name: string; unit?: string; hsn?: string; ratePaise?: number; gstRate?: number };
export type PullOutstanding = { party: string; amountPaise: number }; // positive = the customer owes us
export type Pull = { ledgers?: PullLedger[]; items?: PullItem[]; outstanding?: PullOutstanding[] };

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/**
 * Takes what Tally has and compares it with ours. New customers, suppliers and items are
 * added; anything that disagrees is logged as a conflict for a person to settle, never
 * overwritten.
 */
export async function applyPull(businessId: string, body: Pull) {
  const log = async (kind: string, status: "OK" | "CONFLICT", message: string, refType?: string, refId?: string) => {
    const msg = message.slice(0, 300);
    // The agent runs often; an unresolved conflict is listed once, not on every run.
    if (status === "CONFLICT" && (await db.tallySync.findFirst({ where: { businessId, kind, status, message: msg } }))) return;
    await db.tallySync.create({ data: { businessId, direction: "PULL", kind, status, message: msg, refType: refType ?? null, refId: refId ?? null } });
  };
  const counts = { created: 0, conflicts: 0, matched: 0 };

  const parties = await db.party.findMany({ where: { businessId, archivedAt: null } });
  const byName = new Map(parties.map((p) => [norm(p.name), p]));
  const byGstin = new Map(parties.filter((p) => p.gstin).map((p) => [p.gstin!.toUpperCase(), p]));

  for (const l of (body.ledgers ?? []).slice(0, 2000)) {
    const name = str(l.name, 120);
    const parent = str(l.parent, 60).toLowerCase();
    const type = parent.includes("creditor") ? "SUPPLIER" : parent.includes("debtor") ? "CUSTOMER" : null;
    if (!name || !type) continue;
    const gstin = str(l.gstin, 15).toUpperCase();
    const existing = (gstin && byGstin.get(gstin)) || byName.get(norm(name));
    if (existing) {
      if (gstin && existing.gstin && existing.gstin.toUpperCase() !== gstin) {
        counts.conflicts++;
        await log("LEDGER", "CONFLICT", `${name}: Tally has GSTIN ${gstin}, here it is ${existing.gstin}`, "Party", existing.id);
      } else {
        counts.matched++;
      }
      continue;
    }
    const validGstin = /^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/.test(gstin) ? gstin : null;
    const p = await db.party.create({
      data: {
        businessId, name, type, gstin: validGstin, stateCode: validGstin ? validGstin.slice(0, 2) : null,
        phone: str(l.phone, 15).replace(/\D/g, "").slice(-10) ? `91${str(l.phone, 15).replace(/\D/g, "").slice(-10)}` : null, source: "Tally", shareToken: newShareToken(),
      },
    });
    byName.set(norm(name), p);
    counts.created++;
    await log("LEDGER", "OK", `Added ${type === "SUPPLIER" ? "supplier" : "customer"} ${name} from Tally`, "Party", p.id);
  }

  const items = await db.item.findMany({ where: { businessId, archivedAt: null, parentId: null } });
  const itemByName = new Map(items.map((i) => [norm(i.name), i]));
  for (const it of (body.items ?? []).slice(0, 5000)) {
    const name = str(it.name, 120);
    if (!name) continue;
    const rate = Number.isFinite(it.ratePaise) && (it.ratePaise ?? 0) >= 0 ? Math.round(it.ratePaise ?? 0) : 0;
    const existing = itemByName.get(norm(name));
    if (existing) {
      if (rate > 0 && Number(existing.pricePaise) !== rate) {
        counts.conflicts++;
        await log("ITEM", "CONFLICT", `${name}: Tally rate ₹${(rate / 100).toFixed(2)}, here ₹${(Number(existing.pricePaise) / 100).toFixed(2)}`, "Item", existing.id);
      } else counts.matched++;
      continue;
    }
    const gst = Number.isFinite(it.gstRate) ? Math.min(Math.max(Math.round((it.gstRate ?? 18) * 100), 0), 2800) : 1800;
    const created = await db.item.create({ data: { businessId, name, unit: str(it.unit, 12) || "pcs", pricePaise: BigInt(rate), hsn: str(it.hsn, 8) || null, taxRateBp: gst } });
    itemByName.set(norm(name), created);
    counts.created++;
    await log("ITEM", "OK", `Added item ${name} from Tally`, "Item", created.id);
  }

  if (body.outstanding?.length) {
    const entries = await db.ledgerEntry.findMany({ where: { businessId, partyId: { in: parties.map((p) => p.id) } } });
    const mine = Map.groupBy(entries, (e) => e.partyId);
    for (const o of body.outstanding.slice(0, 5000)) {
      const p = byName.get(norm(str(o.party, 120)));
      if (!p || !Number.isFinite(o.amountPaise)) continue;
      const ours = balanceOf(mine.get(p.id) ?? []);
      if (Math.round(o.amountPaise) !== ours) {
        counts.conflicts++;
        await log("OUTSTANDING", "CONFLICT", `${p.name}: Tally shows ₹${(o.amountPaise / 100).toFixed(2)} due, here ₹${(ours / 100).toFixed(2)}`, "Party", p.id);
      } else counts.matched++;
    }
  }
  await db.business.update({ where: { id: businessId }, data: { tallyLastSyncAt: new Date() } });
  return counts;
}
