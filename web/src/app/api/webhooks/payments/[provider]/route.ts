import { readWebhook } from "@/lib/payments/gateway";
import { settleFromGateway } from "@/lib/payments/settle";

// Payment gateway webhook (CP-05). Only calls with a valid signature change anything.
export async function POST(request: Request, ctx: RouteContext<"/api/webhooks/payments/[provider]">) {
  const { provider } = await ctx.params;
  if (provider !== "razorpay" && provider !== "cashfree") return new Response("Unknown provider", { status: 404 });
  const raw = await request.text();
  const { valid, event } = readWebhook(provider, raw, request.headers);
  if (!valid) return new Response("Bad signature", { status: 401 });
  if (event) await settleFromGateway(event);
  return new Response("ok");
}
