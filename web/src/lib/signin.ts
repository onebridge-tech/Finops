import "server-only";
import { redirect } from "next/navigation";
import type { User } from "@prisma/client";
import { db } from "./db";
import { startSession } from "./session";
import { isPlatformAdmin } from "./platform-admins";

/**
 * Starts a session for someone who has just proved who they are (their password, an email code, or Google), then
 * sends them to their shop or to set one up. Kept out of the server-action files on purpose: anything
 * exported from there can be called from a browser, and this must only run after a real check.
 */
export async function signInUser(userId: string): Promise<never> {
  const [first, user] = await Promise.all([
    db.membership.findFirst({ where: { userId }, orderBy: { createdAt: "asc" } }),
    db.user.findUnique({ where: { id: userId } }),
  ]);
  await startSession(userId, first?.businessId);
  // Platform admins land in the admin area, even when they also have a shop ("Back to app" there opens it).
  if (user && isPlatformAdmin(user)) redirect("/platform");
  redirect(first ? "/dashboard" : "/onboarding");
}

/** Someone invited by email who has not signed in yet. They create their password (and verify the address) by registering with it. */
export async function invitedEmailUser(email: string, name: string | null): Promise<User> {
  return (await db.user.findFirst({ where: { email } })) ?? db.user.create({ data: { email, name } });
}
