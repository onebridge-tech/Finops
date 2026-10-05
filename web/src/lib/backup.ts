import "server-only";
import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { zipSync } from "fflate";
import { db } from "./db";
import { encryptBackup } from "./backup-crypto";

// Automatic backups (SE-04). Each run writes one ZIP holding a consistent copy of
// the SQLite database (VACUUM INTO) and the uploads folder, encrypted with
// AES-256-GCM when BACKUP_KEY is set. Restore with `npm run backup:decrypt`.
// On Postgres, rely on the provider's point-in-time recovery for the database;
// this job then backs up uploaded files only.

const DIR = process.env.BACKUP_DIR ?? path.join(process.cwd(), "backups");
const KEEP = Number(process.env.BACKUP_KEEP ?? 14);
const UPLOADS = process.env.UPLOAD_DIR ?? path.join(process.cwd(), "uploads");

async function walk(dir: string, prefix = ""): Promise<Record<string, Uint8Array>> {
  const out: Record<string, Uint8Array> = {};
  let names: string[];
  try { names = await readdir(dir); } catch { return out; }
  for (const n of names) {
    const full = path.join(dir, n);
    if ((await stat(full)).isDirectory()) Object.assign(out, await walk(full, `${prefix}${n}/`));
    else out[`${prefix}${n}`] = new Uint8Array(await readFile(full));
  }
  return out;
}

export type BackupResult = { file: string; bytes: number; encrypted: boolean; database: boolean; removed: number };

export async function runBackup(): Promise<BackupResult> {
  await mkdir(DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const entries: Record<string, Uint8Array> = {};

  const sqlite = (process.env.DATABASE_URL ?? "").startsWith("file:");
  if (sqlite) {
    const tmp = path.join(DIR, `.tmp-${stamp}.sqlite`);
    // VACUUM INTO writes a consistent snapshot even while the app is writing.
    await db.$executeRawUnsafe(`VACUUM INTO '${tmp.replace(/'/g, "''")}'`);
    entries["database.sqlite"] = new Uint8Array(await readFile(tmp));
    await rm(tmp, { force: true });
  }
  for (const [k, v] of Object.entries(await walk(UPLOADS))) entries[`uploads/${k}`] = v;

  const zip = zipSync(entries, { level: 6 });
  const key = process.env.BACKUP_KEY;
  const data = key ? encryptBackup(zip, key) : zip;
  const file = path.join(DIR, `backup-${stamp}.zip${key ? ".enc" : ""}`);
  await writeFile(file, data);

  // Keep the newest KEEP backups.
  const all = (await readdir(DIR)).filter((n) => n.startsWith("backup-")).sort().reverse();
  const old = all.slice(KEEP);
  for (const n of old) await rm(path.join(DIR, n), { force: true });
  return { file, bytes: data.length, encrypted: !!key, database: sqlite, removed: old.length };
}

export async function listBackups(): Promise<{ name: string; bytes: number; at: Date }[]> {
  try {
    const names = (await readdir(DIR)).filter((n) => n.startsWith("backup-")).sort().reverse();
    return Promise.all(names.map(async (name) => {
      const s = await stat(path.join(DIR, name));
      return { name, bytes: s.size, at: s.mtime };
    }));
  } catch {
    return [];
  }
}

/** True when no backup has been written yet today (UTC), for the daily scheduler. */
export async function backupDueToday(): Promise<boolean> {
  const today = new Date().toISOString().slice(0, 10);
  try {
    return !(await readdir(DIR)).some((n) => n.startsWith(`backup-${today}`));
  } catch {
    return true;
  }
}
