import "server-only";
import { db } from "./db";
import { audit } from "./audit";
import { balanceOf } from "./ledger";
import { normalizeIndianMobile } from "./share";

// Two-sided shared ledger (LG-10). When two businesses both use the platform and
// each has the other as a party, an entry one makes appears for the other to
// accept. A bill I record against you ("you owe me") is, for you, credit
// received from me, so the direction flips on the other side.

export const AUTO_ACCEPT_DAYS = 7;

const flip = (d: string) => (d === "GAVE" ? "GOT" : "GAVE");

/** The platform business a party is, matched by GSTIN or mobile number. Sets the link when found. */
export async function linkCounterpart(partyId: string): Promise<string | null> {
  const p = await db.party.findUnique({ where: { id: partyId } });
  if (!p) return null;
  if (p.linkedBusinessId) return p.linkedBusinessId;
  const phone = p.phone ? normalizeIndianMobile(p.phone) : null;
  const ors = [...(p.gstin ? [{ gstin: p.gstin }] : []), ...(phone ? [{ phone: { contains: phone.slice(-10) } }] : [])];
  if (ors.length === 0) return null;
  const other = await db.business.findFirst({ where: { id: { not: p.businessId }, OR: ors } });
  if (!other) return null;
  await db.party.update({ where: { id: p.id }, data: { linkedBusinessId: other.id } });
  return other.id;
}

/** This business as a party in the other business's books. */
async function mirrorParty(ours: { id: string; gstin: string | null; phone: string | null }, theirBusinessId: string) {
  const linked = await db.party.findFirst({ where: { businessId: theirBusinessId, linkedBusinessId: ours.id, archivedAt: null } });
  if (linked) return linked;
  const phone = ours.phone ? normalizeIndianMobile(ours.phone) : null;
  const ors = [...(ours.gstin ? [{ gstin: ours.gstin }] : []), ...(phone ? [{ phone }] : [])];
  if (ors.length === 0) return null;
  const found = await db.party.findFirst({ where: { businessId: theirBusinessId, archivedAt: null, OR: ors } });
  if (found && !found.linkedBusinessId) await db.party.update({ where: { id: found.id }, data: { linkedBusinessId: ours.id } });
  return found;
}

/**
 * After an entry is recorded for a party that is also on the platform, offer the
 * mirrored entry to the other business. Quietly does nothing when there is no
 * counterpart, or the entry isn't a trade (opening balances, reversals).
 */
export async function proposeShared(entryId: string): Promise<boolean> {
  const e = await db.ledgerEntry.findUnique({ where: { id: entryId }, include: { business: true } });
  if (!e || e.source === "OPENING" || e.source === "REVERSAL" || e.source === "SHARED") return false;
  const theirId = await linkCounterpart(e.partyId);
  if (!theirId) return false;
  const q = await mirrorParty(e.business, theirId);
  if (!q) return false;
  if (await db.sharedEntry.count({ where: { sourceEntryId: e.id } })) return false;
  await db.sharedEntry.create({
    data: {
      businessId: theirId, counterpartBizId: e.businessId, sourceEntryId: e.id, partyId: q.id, direction: flip(e.direction), amountPaise: e.amountPaise,
      date: e.date, note: e.note, autoAcceptAt: new Date(Date.now() + AUTO_ACCEPT_DAYS * 86400_000),
    },
  });
  return true;
}

/** If the sender reverses an entry that is still waiting, withdraw the proposal. */
export async function withdrawShared(entryId: string) {
  await db.sharedEntry.updateMany({ where: { sourceEntryId: entryId, status: "PENDING" }, data: { status: "REJECTED", resolvedAt: new Date() } });
}

async function accept(id: string, actorId: string, status: "ACCEPTED" | "AUTO_ACCEPTED") {
  const s = await db.sharedEntry.findUnique({ where: { id } });
  if (!s || s.status !== "PENDING") return false;
  const from = await db.business.findUnique({ where: { id: s.counterpartBizId }, select: { name: true } });
  await db.$transaction(async (tx) => {
    const e = await tx.ledgerEntry.create({
      data: {
        businessId: s.businessId, partyId: s.partyId, direction: s.direction, amountPaise: s.amountPaise, date: s.date,
        note: `${from?.name ?? "Counterparty"}${s.note ? ": " + s.note : ""}`, source: "SHARED", createdById: actorId,
      },
    });
    await tx.sharedEntry.update({ where: { id }, data: { status, entryId: e.id, resolvedAt: new Date(), resolvedById: actorId } });
    await audit(tx, { businessId: s.businessId, actorId, action: status === "AUTO_ACCEPTED" ? "auto_accept_shared" : "accept_shared", entity: "LedgerEntry", entityId: e.id, data: { from: s.counterpartBizId, sourceEntryId: s.sourceEntryId } });
  });
  return true;
}

export const acceptShared = (id: string, userId: string) => accept(id, userId, "ACCEPTED");

export async function rejectShared(id: string, userId: string, businessId: string) {
  const r = await db.sharedEntry.updateMany({ where: { id, businessId, status: "PENDING" }, data: { status: "REJECTED", resolvedAt: new Date(), resolvedById: userId } });
  return r.count > 0;
}

/** Proposals nobody answered within the window are accepted on the recipient's behalf. */
export async function autoAcceptShared(now = new Date()) {
  const due = await db.sharedEntry.findMany({ where: { status: "PENDING", autoAcceptAt: { lte: now } }, take: 200 });
  let accepted = 0;
  for (const s of due) {
    const owner = await db.membership.findFirst({ where: { businessId: s.businessId, role: "OWNER" }, orderBy: { createdAt: "asc" } });
    if (owner && (await accept(s.id, owner.userId, "AUTO_ACCEPTED"))) accepted++;
  }
  return accepted;
}

export type Mismatch = { partyId: string; partyName: string; counterpart: string; ours: number; theirs: number; difference: number };

/**
 * Linked parties whose two books disagree. Our balance with them (positive =
 * they owe us) should be exactly the opposite of theirs with us.
 */
export async function mismatches(businessId: string): Promise<Mismatch[]> {
  const linked = await db.party.findMany({ where: { businessId, archivedAt: null, linkedBusinessId: { not: null } } });
  const out: Mismatch[] = [];
  for (const p of linked) {
    const ours = await db.business.findUniqueOrThrow({ where: { id: businessId }, select: { id: true, gstin: true, phone: true } });
    const q = await mirrorParty(ours, p.linkedBusinessId!);
    if (!q) continue;
    const [mine, theirs, other] = await Promise.all([
      db.ledgerEntry.findMany({ where: { partyId: p.id } }),
      db.ledgerEntry.findMany({ where: { partyId: q.id } }),
      db.business.findUnique({ where: { id: p.linkedBusinessId! }, select: { name: true } }),
    ]);
    const a = balanceOf(mine);
    const b = balanceOf(theirs);
    if (a + b !== 0) out.push({ partyId: p.id, partyName: p.name, counterpart: other?.name ?? "", ours: a, theirs: b, difference: a + b });
  }
  return out;
}
