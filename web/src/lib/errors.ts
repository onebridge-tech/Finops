import "server-only";
import { db } from "./db";
import { fingerprint, scrub } from "./error-text";

// What went wrong on the server, grouped so the same problem is one line with a count.
// Nothing about the person or the request body is kept: only the route, the message and a short stack.

export type ErrorKind = "SERVER" | "ACTION" | "ROUTE" | "CLIENT";

const SKIP = /NEXT_REDIRECT|NEXT_NOT_FOUND|NEXT_HTTP_ERROR_FALLBACK|DYNAMIC_SERVER_USAGE|BAILOUT/;

export async function recordError(e: { kind: ErrorKind; route: string; method?: string; message: string; stack?: string; digest?: string }): Promise<void> {
  try {
    if (SKIP.test(e.message) || SKIP.test(e.digest ?? "")) return;
    const message = scrub(e.message) || "Unknown error";
    const fp = fingerprint(e.kind, e.route, message);
    const now = new Date();
    await db.errorLog.upsert({
      where: { fingerprint: fp },
      update: { count: { increment: 1 }, lastSeenAt: now, resolvedAt: null, digest: e.digest ?? undefined },
      create: {
        fingerprint: fp, kind: e.kind, route: e.route.slice(0, 200), method: e.method ?? null, message,
        stack: scrub((e.stack ?? "").split("\n").slice(0, 8).join("\n")).slice(0, 1500) || null, digest: e.digest ?? null, firstSeenAt: now, lastSeenAt: now,
      },
    });
  } catch {
    // Logging a problem must never cause another one.
  }
}
