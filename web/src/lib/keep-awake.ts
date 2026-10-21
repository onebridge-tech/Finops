// Free hosting plans (Render's free web service) put the server to sleep after ~15 minutes without visitors, and the next
// visitor waits for it to start again. While the server is running it visits its own public address every few minutes,
// which counts as traffic and keeps it awake.
//   On Render this is on by default (Render sets RENDER and RENDER_EXTERNAL_URL). Elsewhere set KEEP_AWAKE=1 and APP_URL.
//   KEEP_AWAKE=0           turn it off
//   KEEP_AWAKE_MINUTES=10  how often (1–14)
//   KEEP_AWAKE_DB=1        also touch the database, for one that sleeps when idle. Uses more of a free database's monthly hours.

type Env = Record<string, string | undefined>;

/** The address to ping and how often, or null when keep-awake is off. */
export function keepAwakePlan(env: Env): { url: string; everyMs: number } | null {
  if (env.KEEP_AWAKE === "0") return null;
  if (env.KEEP_AWAKE !== "1" && env.RENDER !== "true") return null;
  const base = (env.RENDER_EXTERNAL_URL || env.APP_URL || "").trim().replace(/\/$/, "");
  if (!/^https?:\/\/[^\s/]+/.test(base) || /\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(base)) return null;
  const minutes = Math.min(14, Math.max(1, Number(env.KEEP_AWAKE_MINUTES) || 10));
  return { url: `${base}/api/health${env.KEEP_AWAKE_DB === "1" ? "?db=1" : ""}`, everyMs: minutes * 60_000 };
}

export function startKeepAwake(env: Env = process.env): void {
  const plan = keepAwakePlan(env);
  if (!plan) return;
  const ping = async () => {
    try {
      const res = await fetch(plan.url, { cache: "no-store", signal: AbortSignal.timeout(20_000), headers: { "user-agent": "finops-keep-awake" } });
      if (!res.ok) console.warn("[keep-awake]", res.status, plan.url);
    } catch (e) {
      console.warn("[keep-awake] ping failed", e instanceof Error ? e.message : e);
    }
  };
  setInterval(ping, plan.everyMs).unref?.();
  setTimeout(ping, 60_000).unref?.();
  console.log(`[keep-awake] pinging ${plan.url} every ${plan.everyMs / 60_000} min`);
}
