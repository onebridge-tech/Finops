import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { REF_COOKIE } from "@/lib/referral";

// Invite link (EC-03): remembers who invited this visitor for 30 days, then
// sends them to sign up. Unknown codes just go to sign-up.
export async function GET(_req: Request, ctx: RouteContext<"/join/[code]">) {
  const { code } = await ctx.params;
  if (/^[a-z0-9]{8}$/.test(code) && (await db.business.count({ where: { referralCode: code } }))) {
    (await cookies()).set(REF_COOKIE, code, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 30 * 86400 });
  }
  redirect("/register");
}
