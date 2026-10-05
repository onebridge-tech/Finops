// Hash chain for the audit trail (SE-02). Pure, so it is unit-tested.
import { createHash } from "node:crypto";

export type ChainFields = {
  seq: number;
  businessId: string;
  actorId: string;
  action: string;
  entity: string;
  entityId: string;
  data: string | null;
  createdAt: string; // ISO timestamp
};

/** sha256 over the previous hash and the event's fields, in a fixed order. */
export function chainHash(prevHash: string | null, f: ChainFields): string {
  const canonical = JSON.stringify([prevHash ?? "", f.seq, f.businessId, f.actorId, f.action, f.entity, f.entityId, f.data ?? "", f.createdAt]);
  return createHash("sha256").update(canonical).digest("hex");
}

export type ChainEvent = ChainFields & { id: string; prevHash: string | null; hash: string | null };

export type ChainCheck = { ok: true; checked: number } | { ok: false; checked: number; at: number; reason: string };

/** Walks the chain in order; reports the first event that was altered, removed or inserted. */
export function verifyChain(events: ChainEvent[]): ChainCheck {
  let prev: string | null = null;
  for (const [i, e] of events.entries()) {
    const expectedSeq = i + 1;
    if (e.seq !== expectedSeq) return { ok: false, checked: i, at: expectedSeq, reason: `Event #${expectedSeq} is missing` };
    if (e.prevHash !== prev) return { ok: false, checked: i, at: e.seq, reason: `Event #${e.seq} does not follow the one before it` };
    if (chainHash(prev, e) !== e.hash) return { ok: false, checked: i, at: e.seq, reason: `Event #${e.seq} was changed after it was recorded` };
    prev = e.hash;
  }
  return { ok: true, checked: events.length };
}
