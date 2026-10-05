import { timingSafeEqual } from "node:crypto";
import { runAutoReminders } from "@/lib/reminders";

// Called hourly by an external scheduler (cron, Render cron job, GitHub Actions…):
//   curl -H "Authorization: Bearer $CRON_SECRET" https://<app>/api/cron/reminders
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const given = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (!secret || given.length !== secret.length || !timingSafeEqual(Buffer.from(given), Buffer.from(secret))) {
    return new Response("Unauthorized", { status: 401 });
  }
  return Response.json(await runAutoReminders());
}
