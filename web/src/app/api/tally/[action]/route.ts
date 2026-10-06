import { applyPull, businessForKey, pendingVouchers, recordAcks, type Ack, type Pull } from "@/lib/tally";

// Endpoints for the Tally connector agent (IN-01). Every call needs the business's connector key.
const deny = () => Response.json({ error: "Invalid or missing connector key" }, { status: 401 });

export async function GET(request: Request, ctx: RouteContext<"/api/tally/[action]">) {
  const { action } = await ctx.params;
  const business = await businessForKey(request);
  if (!business) return deny();
  if (action === "pending") return Response.json({ business: business.name, vouchers: await pendingVouchers(business.id) });
  return Response.json({ error: "Not found" }, { status: 404 });
}

export async function POST(request: Request, ctx: RouteContext<"/api/tally/[action]">) {
  const { action } = await ctx.params;
  const business = await businessForKey(request);
  if (!business) return deny();
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Bad request" }, { status: 400 });
  }
  if (action === "ack") {
    const acks = (body as { results?: Ack[] }).results;
    if (!Array.isArray(acks)) return Response.json({ error: "results is required" }, { status: 400 });
    await recordAcks(business.id, acks);
    return Response.json({ ok: true });
  }
  if (action === "pull") return Response.json(await applyPull(business.id, body as Pull));
  return Response.json({ error: "Not found" }, { status: 404 });
}
