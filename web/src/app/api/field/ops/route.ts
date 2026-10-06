import { requireBusiness } from "@/lib/auth";
import { applyOp, type FieldOp } from "@/lib/field-ops";

// Upload endpoint for field operations, used live and by the offline queue (FS-08).
// Operations are applied in order; each carries a client id so retries are harmless.
export async function POST(request: Request) {
  let ctx;
  try {
    ctx = await requireBusiness("ledger:write");
  } catch {
    return Response.json({ error: "Please sign in again" }, { status: 401 });
  }
  let body: { ops?: FieldOp[] };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Bad request" }, { status: 400 });
  }
  const ops = Array.isArray(body.ops) ? body.ops.slice(0, 100) : [];
  const results = [];
  for (const op of ops) results.push(await applyOp(ctx, op));
  return Response.json({ results });
}
