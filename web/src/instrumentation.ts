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
    every(60 * 60 * 1000, () =>
      runHourly()
        .then((s) => console.log("[hourly]", JSON.stringify(s)))
        .catch((e) => console.error("[reminders] run failed", e)),
    );
  }
  if (process.env.BACKUP_SCHEDULER === "1") {
    const { backupDueToday, runBackup } = await import("./lib/backup");
    every(60 * 60 * 1000, async () => {
      try {
        if (await backupDueToday()) console.log("[backup]", await runBackup());
      } catch (e) {
        console.error("[backup] failed", e);
      }
    });
  }
}
