import "server-only";
import { db } from "./db";
import { allFields, INTEGRATIONS, fieldByEnv, type Field, type Integration } from "./integrations-catalog";
import { isEncrypted, maskSecret, openSecret, sealSecret } from "./secret-box";
import { aiConfig } from "./note-ai-providers";

// Connections to outside services, set by a platform admin. Values are stored in SiteSetting under "int:<NAME>" (secrets encrypted),
// and applied over the server's own environment so the rest of the code keeps reading process.env as before.
// A value set here wins over the server's setting; clearing it brings the server's setting back.

const KEY = "int:";
const passphrase = () => `finops-connections:${process.env.SESSION_SECRET ?? ""}`;

type Global = typeof globalThis & { __finopsEnvOriginal?: Map<string, string | undefined> };
const original = () => ((globalThis as Global).__finopsEnvOriginal ??= new Map());

/** Everything saved in the database, decrypted. Values that cannot be opened (the server secret changed) are reported separately. */
export async function storedConnections(): Promise<{ values: Map<string, string>; unreadable: string[] }> {
  const rows = await db.siteSetting.findMany({ where: { key: { startsWith: KEY } } });
  const values = new Map<string, string>();
  const unreadable: string[] = [];
  for (const r of rows) {
    const env = r.key.slice(KEY.length);
    if (!fieldByEnv(env)) continue;
    const v = isEncrypted(r.value) ? openSecret(r.value, passphrase()) : r.value;
    if (v === null) unreadable.push(env);
    else values.set(env, v);
  }
  return { values, unreadable };
}

/** Puts the saved values into process.env (and restores the server's own value for anything cleared). Safe to call often. */
export async function applyConnections(): Promise<void> {
  let values: Map<string, string>;
  try {
    values = (await storedConnections()).values;
  } catch {
    return; // the database is not reachable or not ready yet: keep what is there
  }
  const orig = original();
  for (const f of allFields()) {
    if (values.has(f.env)) {
      if (!orig.has(f.env)) orig.set(f.env, process.env[f.env]);
      process.env[f.env] = values.get(f.env);
    } else if (orig.has(f.env)) {
      const o = orig.get(f.env);
      if (o === undefined) delete process.env[f.env];
      else process.env[f.env] = o;
      orig.delete(f.env);
    }
  }
}

export type FieldState = Field & { source: "admin" | "server" | "none"; shown: string };
export type IntegrationState = Omit<Integration, "fields"> & { fields: FieldState[]; status: "connected" | "partial" | "off" };

/** What each connection looks like right now, for the admin page. Secrets are shown only as their last four characters. */
export async function connectionStates(): Promise<{ list: IntegrationState[]; unreadable: string[] }> {
  const { values, unreadable } = await storedConnections();
  const orig = original();
  const serverValue = (env: string) => (orig.has(env) ? orig.get(env) : process.env[env]);
  const list = INTEGRATIONS.map((i): IntegrationState => {
    const raw: Record<string, string> = {};
    const fields = i.fields.map((f): FieldState => {
      const here = values.get(f.env);
      const server = serverValue(f.env);
      const value = here ?? server ?? "";
      raw[f.env] = value;
      const source = here !== undefined ? "admin" : server ? "server" : "none";
      return { ...f, source, shown: !value ? "" : f.kind === "secret" ? maskSecret(value) : value };
    });
    const required = fields.filter((f) => f.required);
    const set = required.filter((f) => f.shown && f.shown !== "");
    // A mode that is "off" (empty choice) means the service is deliberately not in use.
    const modeOff = required.some((f) => f.kind === "select" && !f.shown);
    const anySet = fields.some((f) => f.source !== "none" && f.shown);
    const status = required.length > 0 && set.length === required.length && !modeOff ? "connected" : anySet && !modeOff ? "partial" : "off";
    // The photo reader is connected when the chosen service has everything it needs, not just when a choice is made.
    return { ...i, fields, status: i.id === "ai" ? (aiConfig(raw) ? "connected" : anySet ? "partial" : "off") : status };
  });
  return { list, unreadable };
}

/** Saves one connection's fields. A blank secret keeps what is saved; "clear" removes the value and brings back the server's own. Returns the names changed. */
export async function saveConnection(id: string, form: FormData, adminId: string): Promise<{ ok: true; changed: string[] } | { ok: false; error: string }> {
  const integ = INTEGRATIONS.find((i) => i.id === id);
  if (!integ) return { ok: false, error: "Unknown connection" };
  const changed: string[] = [];
  const ops: ReturnType<typeof db.siteSetting.upsert | typeof db.siteSetting.deleteMany>[] = [];
  for (const f of integ.fields) {
    const raw = String(form.get(f.env) ?? "").trim();
    const clear = form.get(`clear_${f.env}`) === "on";
    if (clear || (raw === "" && f.kind !== "secret")) {
      ops.push(db.siteSetting.deleteMany({ where: { key: KEY + f.env } }));
      changed.push(f.env);
      continue;
    }
    if (raw === "") continue; // a blank secret box keeps the saved key
    if (raw.length > 500 || /[\r\n]/.test(raw)) return { ok: false, error: `${f.label}: that value does not look right.` };
    if (f.kind === "select" && !f.options?.some(([v]) => v === raw)) return { ok: false, error: `${f.label}: choose one of the options.` };
    if (f.env === "NOTE_AI_BASE_URL" && !/^https:\/\/[^\s]+$/.test(raw)) return { ok: false, error: `${f.label}: it must start with https://` };
    if (f.env === "NOTE_SCAN_FREE_PER_MONTH" && !/^\d{1,4}$/.test(raw)) return { ok: false, error: `${f.label}: type a whole number.` };
    const value = f.kind === "secret" ? sealSecret(raw, passphrase()) : raw;
    ops.push(db.siteSetting.upsert({ where: { key: KEY + f.env }, update: { value, updatedById: adminId }, create: { key: KEY + f.env, value, updatedById: adminId } }));
    changed.push(f.env);
  }
  await db.$transaction(ops);
  await applyConnections();
  return { ok: true, changed };
}
