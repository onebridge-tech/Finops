import "server-only";
import { db } from "./db";
import { recordError } from "./errors";

// A note of every scheduled job run, so the admin area can say whether the background work is really happening.

/** Runs `fn`, records when it started, whether it worked and a short summary. Errors are recorded and re-thrown. */
export async function recordJob<T>(name: string, fn: () => Promise<T>, source: "scheduler" | "cron" = "scheduler"): Promise<T> {
  const run = await db.jobRun.create({ data: { name, source } }).catch(() => null);
  try {
    const result = await fn();
    if (run) await db.jobRun.update({ where: { id: run.id }, data: { finishedAt: new Date(), ok: true, summary: JSON.stringify(result ?? null).slice(0, 1500) } }).catch(() => undefined);
    return result;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (run) await db.jobRun.update({ where: { id: run.id }, data: { finishedAt: new Date(), ok: false, error: message.slice(0, 500) } }).catch(() => undefined);
    await recordError({ kind: "ROUTE", route: `job:${name}`, message, stack: e instanceof Error ? e.stack : undefined });
    throw e;
  }
}
