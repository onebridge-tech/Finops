import "server-only";
import { redirect } from "next/navigation";
import { db } from "./db";
import { startSession } from "./session";

/**
 * Starts a session for someone who has just proved who they are (a correct code, or Google), then
 * sends them to their shop or to set one up. Kept out of the server-action files on purpose: anything
 * exported from there can be called from a browser, and this must only run after a real check.
 */
export async function signInUser(userId: string): Promise<never> {
  const first = await db.membership.findFirst({ where: { userId }, orderBy: { createdAt: "asc" } });
  await startSession(userId, first?.businessId);
  redirect(first ? "/dashboard" : "/onboarding");
}
