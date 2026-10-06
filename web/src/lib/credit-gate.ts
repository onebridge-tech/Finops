import "server-only";
import { db } from "./db";
import { balanceOf, overdueAmount } from "./ledger";
import { formatINR } from "./money";
import { checkCredit } from "./rules";
import { can, type Ctx } from "./auth";

export type GateResult = { error?: string; warning?: string[] };

/**
 * Credit control (CP-07): before a new bill or credit is booked against a
 * party, compare it with their credit limit and overdue bills. "Warn" shows the
 * reasons and lets the member continue (`override`); "Block" stops everyone who
 * can't approve credit overrides.
 */
export async function creditGate(
  ctx: Ctx,
  party: { id: string; type: string; creditLimitPaise: bigint | null },
  newAmountPaise: number,
  override: boolean,
): Promise<GateResult> {
  if (party.type === "SUPPLIER") return {};
  const b = ctx.business;
  if (b.creditControl === "OFF") return {};
  const [entries, allocations] = await Promise.all([
    db.ledgerEntry.findMany({ where: { partyId: party.id } }),
    db.allocation.findMany({ where: { partyId: party.id } }),
  ]);
  const check = checkCredit({
    control: b.creditControl as "WARN" | "BLOCK",
    limitPaise: party.creditLimitPaise === null ? null : Number(party.creditLimitPaise),
    balance: balanceOf(entries),
    overdue: overdueAmount(entries, new Date(), allocations),
    newAmount: newAmountPaise,
    blockOverdue: b.creditBlockOverdue,
    canOverride: can(ctx.role, "credit:override"),
    fmt: formatINR,
  });
  if (check.action === "block") return { error: `${check.reasons.join(". ")}. An owner or admin must approve this.` };
  if (check.action === "warn" && !override) return { warning: check.reasons };
  return {};
}
