import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { googleEnabled, profileFromCode } from "@/lib/google";
import { readSession } from "@/lib/session";
import { signInUser } from "@/lib/signin";

// Step 2: Google sends the person back here with a one-time code.
// Redirects must go to the public address, not the server's internal one.
const abs = (path: string) => new URL(path, process.env.APP_URL ?? "http://localhost:3000");

export async function GET(request: Request) {
  const url = new URL(request.url);
  const fail = (e: string, to = "/login") => Response.redirect(abs(`${to}?error=${e}`));
  if (!googleEnabled()) return fail("google_off");

  const jar = await cookies();
  const saved = jar.get("g_oauth")?.value;
  jar.delete("g_oauth");
  let flow: { state: string; verifier: string; link: boolean };
  try { flow = JSON.parse(saved ?? ""); } catch { return fail("google_failed"); }

  const code = url.searchParams.get("code");
  if (url.searchParams.get("error") || !code || url.searchParams.get("state") !== flow.state) return fail("google_failed");
  const profile = await profileFromCode(code, flow.verifier);
  if (!profile) return fail("google_failed");

  if (flow.link) {
    const s = await readSession();
    if (!s) return fail("google_failed");
    const other = await db.user.findUnique({ where: { googleSub: profile.sub } });
    if (other && other.id !== s.uid) return fail("google_taken", "/settings/security");
    const me = await db.user.findUnique({ where: { id: s.uid } });
    const emailTaken = !me?.email ? await db.user.findUnique({ where: { email: profile.email } }) : null;
    await db.user.update({
      where: { id: s.uid },
      data: { googleSub: profile.sub, ...(me && !me.email && !emailTaken ? { email: profile.email, emailVerifiedAt: new Date() } : {}) },
    });
    return Response.redirect(abs("/settings/security?linked=google"));
  }

  // Signing in: the Google account first, then a person who already uses this (verified) email, else a new account.
  let user = await db.user.findUnique({ where: { googleSub: profile.sub } });
  if (!user) {
    const byEmail = await db.user.findUnique({ where: { email: profile.email } });
    user = byEmail
      ? await db.user.update({ where: { id: byEmail.id }, data: { googleSub: profile.sub, emailVerifiedAt: byEmail.emailVerifiedAt ?? new Date() } })
      : await db.user.create({ data: { email: profile.email, emailVerifiedAt: new Date(), googleSub: profile.sub, name: profile.name } });
  }
  return signInUser(user.id);
}
