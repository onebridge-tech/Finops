import "server-only";
import { cache } from "react";
import { connection } from "next/server";
import { db } from "./db";

// Company details that the legal pages and the landing page show. A platform admin fills them in under
// Platform admin > Company info; anything left empty is simply left out of the pages (never shown as a gap).

import { SITE_FIELDS, type SiteKey } from "./site-fields";
export { SITE_FIELDS, type SiteField, type SiteKey } from "./site-fields";

export type SiteInfo = Record<SiteKey, string> & { replyDaysNum: number; deleteDaysNum: number };

const num = (v: string, fallback: number) => {
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 && n <= 365 ? n : fallback;
};

/** Everything the admin has filled in, with defaults for the few values that have one. Never throws, so public pages still open if the database is busy. */
export const getSite = cache(async (): Promise<SiteInfo> => {
  await connection(); // always read the current details, never a copy made at build time
  return readSite();
});

/** The same, for work done outside a page or action (scheduled jobs), where there is no request to wait for. */
export async function readSite(): Promise<SiteInfo> {
  const stored = new Map<string, string>();
  try {
    for (const r of await db.siteSetting.findMany()) stored.set(r.key, r.value);
  } catch {
    // fall back to the defaults below
  }
  const out = {} as SiteInfo;
  for (const f of SITE_FIELDS) out[f.key] = (stored.get(f.key) ?? f.default ?? "").trim();
  out.replyDaysNum = num(out.replyDays, 15);
  out.deleteDaysNum = num(out.deleteDays, 30);
  return out;
}
