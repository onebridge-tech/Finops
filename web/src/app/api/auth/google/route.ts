import { cookies } from "next/headers";
import { authUrl, googleEnabled, newOAuthState } from "@/lib/google";

// Step 1: send the person to Google. `?link=1` adds Google to the account they are already signed in to.
// Redirects must go to the public address, not the server's internal one.
const abs = (path: string) => new URL(path, process.env.APP_URL ?? "http://localhost:3000");

export async function GET(request: Request) {
  if (!googleEnabled()) return Response.redirect(abs("/login?error=google_off"));
  const link = new URL(request.url).searchParams.get("link") === "1";
  const { state, verifier, challenge } = newOAuthState();
  (await cookies()).set("g_oauth", JSON.stringify({ state, verifier, link }), {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/api/auth/google", maxAge: 600,
  });
  return Response.redirect(authUrl(state, challenge));
}
