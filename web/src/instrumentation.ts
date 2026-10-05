// Built-in hourly reminder scheduler for a single long-running server (dev, or a
// small VPS). Enable with REMINDER_SCHEDULER=1. On serverless hosts leave it off
// and call /api/cron/reminders from an external cron instead.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.REMINDER_SCHEDULER !== "1") return;
  const { runAutoReminders } = await import("./lib/reminders");
  const tick = () =>
    runAutoReminders()
      .then((s) => s.checked && console.log("[reminders]", s))
      .catch((e) => console.error("[reminders] run failed", e));
  setInterval(tick, 60 * 60 * 1000);
  setTimeout(tick, 30_000);
}
