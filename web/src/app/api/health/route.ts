import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// A cheap "is it up" check for uptime monitors and the keep-awake ping. Add ?db=1 to also touch the database
// (that wakes a database that sleeps when idle, like Neon's free plan).
export async function GET(request: Request) {
  const checkDb = new URL(request.url).searchParams.get("db") === "1";
  if (!checkDb) return Response.json({ ok: true }, { headers: { "cache-control": "no-store" } });
  const t0 = Date.now();
  try {
    await db.$queryRaw`SELECT 1`;
    return Response.json({ ok: true, dbMs: Date.now() - t0 }, { headers: { "cache-control": "no-store" } });
  } catch {
    return Response.json({ ok: false, db: "unreachable" }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
