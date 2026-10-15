import { recordError } from "@/lib/errors";

// Browsers report a crash here (from the error page). Small, rate-limited, and nothing private is stored.
const hits = new Map<string, { n: number; at: number }>();

export async function POST(request: Request) {
  const ip = (request.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown").trim();
  const now = Date.now();
  const h = hits.get(ip);
  if (!h || now - h.at > 60_000) hits.set(ip, { n: 1, at: now });
  else if (++h.n > 10) return new Response(null, { status: 429 });
  if (hits.size > 5000) hits.clear();

  let body: { message?: unknown; digest?: unknown; path?: unknown };
  try {
    body = await request.json();
  } catch {
    return new Response(null, { status: 400 });
  }
  const message = typeof body.message === "string" ? body.message.slice(0, 300) : "";
  const path = typeof body.path === "string" ? body.path.split("?")[0]!.replace(/\/[a-z0-9]{20,}/gi, "/:id").slice(0, 120) : "unknown";
  if (!message) return new Response(null, { status: 400 });
  await recordError({ kind: "CLIENT", route: path, message, digest: typeof body.digest === "string" ? body.digest.slice(0, 40) : undefined });
  return new Response(null, { status: 204 });
}
