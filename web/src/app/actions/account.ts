"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { cancelDeletion, requestDeletion } from "@/lib/erase";
import { verifyPassword } from "@/lib/password";
import { serverAdminEmail } from "@/lib/platform-auth";
import { hit, limited, MIN } from "@/lib/rate-limit";

export type DeleteState = { error?: string };

/** "Delete my account": checks it is really them, then closes the account (lib/erase.ts). */
export async function requestAccountDeletion(_prev: DeleteState, form: FormData): Promise<DeleteState> {
  const { user, session } = await requireUser({ closedAccountOk: true });
  if (user.deletionRequestedAt) redirect("/account/delete");
  if (user.email && user.email === serverAdminEmail()) return { error: "This admin account is set on the server (PLATFORM_ADMIN_EMAIL), so it can’t be deleted here. Remove it from the server settings instead." };
  if (form.get("understand") !== "on") return { error: "Tick the box to confirm you understand what will be deleted." };
  if (user.passwordHash) {
    const key = `delete:${user.id}`;
    if (await limited({ key, max: 5, windowMs: 15 * MIN })) return { error: "Too many tries. Wait 15 minutes and try again." };
    if (!(await verifyPassword(String(form.get("password") ?? ""), user.passwordHash))) {
      await hit(key);
      return { error: "That password isn’t right. Enter the password you sign in with." };
    }
  } else if (String(form.get("confirm") ?? "").trim().toUpperCase() !== "DELETE") {
    return { error: "Type DELETE in the box to confirm." };
  }
  await requestDeletion(user.id, session.sid);
  redirect("/account/delete");
}

/** Changes their mind before the erase date. */
export async function keepAccount(): Promise<void> {
  const { user } = await requireUser({ closedAccountOk: true });
  if (user.deletionRequestedAt) await cancelDeletion(user.id);
  redirect("/dashboard");
}
