import "server-only";
import { createHash, randomBytes } from "node:crypto";

// "Sign in with Google" (OAuth 2.0 authorization code flow with PKCE). It switches on by itself
// when GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set; until then the button is hidden.
//
// In Google Cloud Console → APIs & Services → Credentials → Create OAuth client ID (Web application),
// add this authorised redirect URI:   <APP_URL>/api/auth/google/callback

export const googleEnabled = () => !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;

export const redirectUri = () => `${(process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "")}/api/auth/google/callback`;

const b64 = (b: Buffer) => b.toString("base64url");

export function newOAuthState() {
  const verifier = b64(randomBytes(32));
  return { state: b64(randomBytes(16)), verifier, challenge: b64(createHash("sha256").update(verifier).digest()) };
}

export function authUrl(state: string, challenge: string): string {
  const q = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!, redirect_uri: redirectUri(), response_type: "code", scope: "openid email profile",
    state, code_challenge: challenge, code_challenge_method: "S256", prompt: "select_account",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
}

export type GoogleProfile = { sub: string; email: string; name: string | null };

/** Trades the one-time code for the person's verified Google profile, or returns null. */
export async function profileFromCode(code: string, verifier: string): Promise<GoogleProfile | null> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code, client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri(), grant_type: "authorization_code", code_verifier: verifier,
    }),
  });
  if (!res.ok) return null;
  const { id_token } = (await res.json()) as { id_token?: string };
  if (!id_token) return null;
  // Google checks the signature and expiry of its own token for us.
  const check = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(id_token)}`);
  if (!check.ok) return null;
  const t = (await check.json()) as { aud?: string; iss?: string; sub?: string; email?: string; email_verified?: string | boolean; name?: string };
  const issuerOk = t.iss === "https://accounts.google.com" || t.iss === "accounts.google.com";
  const verified = t.email_verified === true || t.email_verified === "true";
  if (t.aud !== process.env.GOOGLE_CLIENT_ID || !issuerOk || !verified || !t.sub || !t.email) return null;
  return { sub: t.sub, email: t.email.toLowerCase(), name: t.name ?? null };
}
