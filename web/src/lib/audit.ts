import "server-only";
import type { Prisma } from "@prisma/client";

const json = (v: unknown) => JSON.stringify(v, (_k, x) => (typeof x === "bigint" ? x.toString() : x));

/** Write an audit event inside the same transaction as the change it records. */
export function audit(
  tx: Prisma.TransactionClient,
  e: { businessId: string; actorId: string; action: string; entity: string; entityId: string; data?: unknown },
) {
  return tx.auditEvent.create({
    data: { ...e, data: e.data === undefined ? null : json(e.data) },
  });
}
