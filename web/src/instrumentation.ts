// Built-in schedulers for a single long-running server (dev, or a small VPS).
//   REMINDER_SCHEDULER=1  hourly auto-reminders (CP-02)
//   BACKUP_SCHEDULER=1    one backup a day (SE-04)
// On serverless hosts leave these off and call /api/cron/reminders and
// /api/cron/backup from an external cron instead.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if ((process.env.DATABASE_URL ?? "").startsWith("postgres")) {
    // One account per email address and per Google account. The names match what Prisma would create for @unique.
    const { db } = await import("./lib/db");
    for (const sql of [
      'CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User" ("email")',
      'CREATE UNIQUE INDEX IF NOT EXISTS "User_googleSub_key" ON "User" ("googleSub")',
    ]) {
      await db.$executeRawUnsafe(sql).catch((e) => console.error("[startup] index failed", e instanceof Error ? e.message : e));
    }
  }
  const every = (ms: number, job: () => Promise<unknown>) => {
    setInterval(job, ms);
    setTimeout(job, 30_000);
  };
  if (process.env.REMINDER_SCHEDULER === "1") {
    const { runHourly } = await import("./lib/jobs");
    const { recordJob } = await import("./lib/job-runs");
    every(60 * 60 * 1000, () =>
      recordJob("hourly", () => runHourly())
        .then((s) => console.log("[hourly]", JSON.stringify(s)))
        .catch((e) => console.error("[reminders] run failed", e)),
    );
  }
  if (process.env.BACKUP_SCHEDULER === "1") {
    const { backupDueToday, runBackup } = await import("./lib/backup");
    const { recordJob } = await import("./lib/job-runs");
    every(60 * 60 * 1000, async () => {
      try {
        if (await backupDueToday()) console.log("[backup]", await recordJob("backup", () => runBackup()));
      } catch (e) {
        console.error("[backup] failed", e);
      }
    });
  }
}

/**
 * Next.js calls this for every error thrown while serving a request: pages, server actions and route handlers.
 * We keep the route, a cleaned message and a short stack, grouped so repeats are one line with a count.
 */
export async function onRequestError(
  err: unknown,
  request: { path: string; method: string },
  context: { routePath?: string; routeType?: string },
) {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { recordError } = await import("./lib/errors");
  const e = err instanceof Error ? err : new Error(String(err));
  const kind = context.routeType === "action" ? "ACTION" : context.routeType === "route" ? "ROUTE" : "SERVER";
  await recordError({
    kind, route: context.routePath ?? request.path.split("?")[0] ?? "unknown", method: request.method,
    message: e.message, stack: e.stack, digest: (e as { digest?: string }).digest,
  });
}
