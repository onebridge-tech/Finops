import "server-only";
import { after } from "next/server";
import { db } from "./db";
import { readSession } from "./session";

/**
 * Counts a view of a shared invoice or quotation (BD-05). Views by people
 * signed in to the issuing business don't count.
 */
export async function trackView(kind: "invoice" | "quote", id: string, businessId: string) {
  const s = await readSession();
  if (s?.bid === businessId) return;
  after(async () => {
    const now = new Date();
    const data = { viewCount: { increment: 1 }, lastViewedAt: now };
    if (kind === "invoice") {
      await db.invoice.update({ where: { id }, data });
      await db.invoice.updateMany({ where: { id, firstViewedAt: null }, data: { firstViewedAt: now } });
    } else {
      await db.quote.update({ where: { id }, data });
      await db.quote.updateMany({ where: { id, firstViewedAt: null }, data: { firstViewedAt: now } });
    }
  });
}
