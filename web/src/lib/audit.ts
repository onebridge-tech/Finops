import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { chainHash, verifyChain } from "./audit-chain";

const json = (v: unknown) => JSON.stringify(v, (_k, x) => (typeof x === "bigint" ? x.toString() : x));

/**
 * Writes an audit event inside the same transaction as the change it records,
 * chained to the business's previous event (SE-02). The (businessId, seq)
 * unique key stops two concurrent writers from forking the chain.
 */
export async function audit(
  tx: Prisma.TransactionClient,
  e: { businessId: string; actorId: string; action: string; entity: string; entityId: string; data?: unknown },
) {
  const last = await tx.auditEvent.findFirst({
    where: { businessId: e.businessId, seq: { not: null } },
    orderBy: { seq: "desc" },
    select: { seq: true, hash: true },
  });
  const seq = (last?.seq ?? 0) + 1;
  const prevHash = last?.hash ?? null;
  const createdAt = new Date();
  const data = e.data === undefined ? null : json(e.data);
  const hash = chainHash(prevHash, { ...e, seq, data, createdAt: createdAt.toISOString() });
  return tx.auditEvent.create({ data: { ...e, data, seq, prevHash, hash, createdAt } });
}

/** Re-computes the whole chain for a business. */
export async function verifyAudit(businessId: string) {
  const events = await db.auditEvent.findMany({ where: { businessId, seq: { not: null } }, orderBy: { seq: "asc" } });
  return verifyChain(events.map((e) => ({ ...e, seq: e.seq!, createdAt: e.createdAt.toISOString() })));
}
