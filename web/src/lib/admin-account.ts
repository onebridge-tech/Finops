import "server-only";
import { db } from "./db";
import { normalizeEmail } from "./identity";
import { hashPassword, passwordProblem, verifyPassword } from "./password";

// The platform admin's sign-in, set on the server so it is always there:
//   PLATFORM_ADMIN_EMAIL=you@onebridgeinfotech.com
//   PLATFORM_ADMIN_PASSWORD=<a long password>
// At every start the account is created if missing, marked verified, and given that password. To change the
// password, change it on the server and restart; it can't be changed from inside the app.

export async function ensureAdminAccount(env: Record<string, string | undefined> = process.env): Promise<"off" | "weak" | "created" | "updated" | "same"> {
  const email = normalizeEmail(env.PLATFORM_ADMIN_EMAIL ?? "");
  const password = env.PLATFORM_ADMIN_PASSWORD ?? "";
  if (!email || !password) return "off";
  const problem = passwordProblem(password, email);
  if (problem || password.length < 12) {
    console.error(`[admin] PLATFORM_ADMIN_PASSWORD not used: ${problem ?? "use at least 12 characters for the admin"}`);
    return "weak";
  }
  const user = await db.user.findFirst({ where: { email } });
  if (!user) {
    await db.user.create({ data: { email, name: "Platform admin", emailVerifiedAt: new Date(), passwordHash: await hashPassword(password), passwordChangedAt: new Date() } });
    return "created";
  }
  const same = await verifyPassword(password, user.passwordHash);
  if (same && user.emailVerifiedAt) return "same";
  await db.user.update({
    where: { id: user.id },
    data: { emailVerifiedAt: user.emailVerifiedAt ?? new Date(), ...(same ? {} : { passwordHash: await hashPassword(password), passwordChangedAt: new Date() }) },
  });
  if (!same) await db.session.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } }); // a new password signs old devices out
  return "updated";
}
