import "server-only";
import { redirect } from "next/navigation";
import type { User } from "@prisma/client";
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

/** The person who owns this email address, created on first use. The address is marked verified because a code just reached it. */
export async function emailUser(email: string): Promise<User> {
  const found = await db.user.findFirst({ where: { email } });
  if (found) return found.emailVerifiedAt ? found : db.user.update({ where: { id: found.id }, data: { emailVerifiedAt: new Date() } });
  try {
    return await db.user.create({ data: { email, emailVerifiedAt: new Date() } });
  } catch (e) {
    const again = await db.user.findFirst({ where: { email } }); // two sign-ins at the same moment
    if (again) return again;
    throw e;
  }
}

/** Someone invited by email who has not signed in yet. Their address is verified on their first sign-in. */
export async function invitedEmailUser(email: string, name: string | null): Promise<User> {
  return (await db.user.findFirst({ where: { email } })) ?? db.user.create({ data: { email, name } });
}
