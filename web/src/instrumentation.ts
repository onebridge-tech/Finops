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
      // Email + password sign-in. Safe to run every start; they match prisma/schema.prisma, so a later `prisma db push` changes nothing.
      'ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "mobile" TEXT',
      'ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "mobileVerifiedAt" TIMESTAMP(3)',
      'ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "passwordHash" TEXT',
      'ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "passwordChangedAt" TIMESTAMP(3)',
      `ALTER TABLE "OtpCode" ADD COLUMN IF NOT EXISTS "purpose" TEXT NOT NULL DEFAULT 'LOGIN'`,
      // Deleting an account (lib/erase.ts).
      'ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "deletionRequestedAt" TIMESTAMP(3)',
      'ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "closingAt" TIMESTAMP(3)',
      'ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "closingById" TEXT',
      'CREATE TABLE IF NOT EXISTS "RateHit" ("id" TEXT NOT NULL, "key" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "RateHit_pkey" PRIMARY KEY ("id"))',
      'CREATE INDEX IF NOT EXISTS "RateHit_key_createdAt_idx" ON "RateHit" ("key", "createdAt")',
    ]) {
      await db.$executeRawUnsafe(sql).catch((e) => console.error("[startup] index failed", e instanceof Error ? e.message : e));
    }
    // The platform admin's email + password from the server settings (see lib/admin-account.ts).
    const { ensureAdminAccount } = await import("./lib/admin-account");
    await ensureAdminAccount()
      .then((r) => console.log(r === "off"
        ? `[admin] no server admin login: PLATFORM_ADMIN_EMAIL is ${process.env.PLATFORM_ADMIN_EMAIL?.trim() ? "set" : "missing"}, PLATFORM_ADMIN_PASSWORD is ${process.env.PLATFORM_ADMIN_PASSWORD ? "set" : "missing"}`
        : `[admin] admin account for ${process.env.PLATFORM_ADMIN_EMAIL?.trim().toLowerCase()}: ${r}`))
      .catch((e) => console.error("[admin] could not set up the admin account", e instanceof Error ? e.message : e));
  }
  // Connections set by a platform admin (keys for AI, SMS, email, payments…) are put in place at start and refreshed every minute,
  // so a change made on one server instance reaches the others too.
  const { applyConnections } = await import("./lib/integrations");
  await applyConnections();
  setInterval(() => void applyConnections(), 60_000);

  // Keeps a free-plan server from falling asleep between visitors (see lib/keep-awake.ts).
  const { startKeepAwake } = await import("./lib/keep-awake");
  startKeepAwake();

  const every = (ms: number, job: () => Promise<unknown>) => {
    setInterval(job, ms);
    setTimeout(job, 30_000);
  };
  // Deleted accounts are erased on time whether or not the other schedulers are on (lib/erase.ts); it also runs in runHourly.
  every(60 * 60 * 1000, async () => {
    const { eraseDueAccounts } = await import("./lib/erase");
    await eraseDueAccounts().then((r) => r.erased && console.log("[erase]", JSON.stringify(r))).catch((e) => console.error("[erase] run failed", e));
  });
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
