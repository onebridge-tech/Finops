import { timingSafeEqual } from "node:crypto";
import { runBackup } from "@/lib/backup";

// Daily backup trigger for an external scheduler (same CRON_SECRET as reminders).
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const given = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (!secret || given.length !== secret.length || !timingSafeEqual(Buffer.from(given), Buffer.from(secret))) {
    return new Response("Unauthorized", { status: 401 });
  }
  const r = await runBackup();
  return Response.json({ ...r, file: r.file.split(/[\\/]/).pop() });
}
