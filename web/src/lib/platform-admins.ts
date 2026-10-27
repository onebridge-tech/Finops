import { normalizeEmail } from "./identity";
import { normalizeIndianMobile } from "./share";

// Platform admins are the people who run FinOps itself, not a shop. They are named in the
// environment (PLATFORM_ADMIN_PHONES, PLATFORM_ADMIN_EMAILS; comma separated), never in the app,
// so nobody can promote themselves and removing a name there removes the access at once.

const phones = () => (process.env.PLATFORM_ADMIN_PHONES ?? "").split(",").map((p) => normalizeIndianMobile(p.trim())).filter((p): p is string => !!p);
const emails = () => [process.env.PLATFORM_ADMIN_EMAIL ?? "", ...(process.env.PLATFORM_ADMIN_EMAILS ?? "").split(",")].map((e) => normalizeEmail(e)).filter((e): e is string => !!e);

/** The admin account whose password is set on the server (PLATFORM_ADMIN_EMAIL + PLATFORM_ADMIN_PASSWORD), if any. */
export const serverAdminEmail = () => (process.env.PLATFORM_ADMIN_PASSWORD ? normalizeEmail(process.env.PLATFORM_ADMIN_EMAIL ?? "") : null);

export function isPlatformAdmin(u: { phone?: string | null; email?: string | null; emailVerifiedAt?: Date | null }): boolean {
  if (u.phone && phones().includes(u.phone)) return true; // a phone number is only stored after its code was entered
  return !!u.email && !!u.emailVerifiedAt && emails().includes(u.email.toLowerCase());
}
