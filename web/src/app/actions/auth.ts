"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { endSession, hashOtp, hashPin, newOtp, readSession, updateSession, verifyPin } from "@/lib/session";
import { normalizeIndianMobile } from "@/lib/share";
import { deliver, isTestMode } from "@/lib/messaging/providers";
import { normalizeEmail } from "@/lib/identity";
import { BRAND } from "@/lib/brand";
import { signInUser } from "@/lib/signin";

export type Method = "phone" | "email";
export type OtpState = { step: "start" | "verify"; method: Method; to?: string; devCode?: string; error?: string };

const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const MAX_CODES_PER_HOUR = 5;
const MAX_PIN_FAILURES = 5;

/** What the code is tied to: the phone number, or the email address with a prefix so the two can never collide. */
const keyFor = (method: Method, to: string) => (method === "email" ? `email:${to}` : to);
const where = (method: Method, to: string) => (method === "email" ? { email: to } : { phone: to });

function clean(method: Method, raw: string): string | null {
  return method === "email" ? normalizeEmail(raw) : normalizeIndianMobile(raw);
}

/** Sends a one-time code by SMS or email (or shows it on screen in test mode). */
async function sendCode(method: Method, to: string, code: string): Promise<{ ok: true; devCode?: string } | { ok: false; error: string }> {
  if (process.env.OTP_DEV_MODE === "1") {
    console.log(`[dev] OTP for ${to}: ${code}`);
    return { ok: true, devCode: code };
  }
  if (method === "phone") {
    if (isTestMode("SMS")) return { ok: false, error: "SMS delivery is not set up yet. Try email or Google instead." };
    const r = await deliver({ channel: "SMS", to, kind: "OTP", lang: "en", params: [code], subject: "", body: `${code} is your login code. It expires in 10 minutes.` });
    return r.ok ? { ok: true } : { ok: false, error: "Couldn’t send the code. Please try again." };
  }
  if (isTestMode("EMAIL")) return { ok: false, error: "Email delivery is not set up yet. Try Google or your phone instead." };
  const r = await deliver({
    channel: "EMAIL", to, kind: "OTP", lang: "en", params: [code], subject: `${BRAND.NAME} sign-in code: ${code}`,
    body: `Your ${BRAND.NAME} sign-in code is ${code}.\n\nIt expires in 10 minutes. If you did not ask for it, you can ignore this email.`,
  });
  return r.ok ? { ok: true } : { ok: false, error: "Couldn’t send the email. Please try again." };
}

async function requestOtp(form: FormData): Promise<OtpState> {
  const method: Method = form.get("method") === "email" ? "email" : "phone";
  const to = clean(method, String(form.get("to") ?? ""));
  if (!to) return { step: "start", method, error: method === "email" ? "Enter a valid email address." : "Enter a valid 10-digit Indian mobile number." };

  const recent = await db.otpCode.count({ where: { ...where(method, to), createdAt: { gt: new Date(Date.now() - 3600_000) } } });
  if (recent >= MAX_CODES_PER_HOUR) return { step: "start", method, error: "Too many codes requested. Try again in an hour." };

  const code = newOtp();
  await db.otpCode.create({ data: { ...where(method, to), codeHash: hashOtp(keyFor(method, to), code), expiresAt: new Date(Date.now() + OTP_TTL_MS) } });
  const sent = await sendCode(method, to, code);
  return sent.ok ? { step: "verify", method, to, devCode: sent.devCode } : { step: "start", method, error: sent.error };
}

/** Single entry point for the login form: requests a code, or verifies one if `code` is present. */
export async function login(prev: OtpState, form: FormData): Promise<OtpState> {
  return form.has("code") ? verifyOtp(prev, form) : requestOtp(form);
}

/** Checks a code and consumes it. Returns an error message, or null when the code was right. */
async function checkCode(method: Method, to: string, code: string): Promise<string | null> {
  const otp = await db.otpCode.findFirst({ where: { ...where(method, to), consumedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" } });
  if (!otp || otp.attempts >= MAX_ATTEMPTS) return "Code expired. Request a new one.";
  if (otp.codeHash !== hashOtp(keyFor(method, to), code)) {
    await db.otpCode.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
    return "Incorrect code.";
  }
  await db.otpCode.update({ where: { id: otp.id }, data: { consumedAt: new Date() } });
  return null;
}

async function verifyOtp(prev: OtpState, form: FormData): Promise<OtpState> {
  const method: Method = form.get("method") === "email" ? "email" : "phone";
  const to = clean(method, String(form.get("to") ?? ""));
  const code = String(form.get("code") ?? "").trim();
  if (!to) return { step: "start", method };

  const bad = await checkCode(method, to, code);
  if (bad === "Incorrect code.") return { ...prev, step: "verify", method, to, error: bad };
  if (bad) return { step: "start", method, error: bad };

  const user = method === "email"
    ? await db.user.upsert({ where: { email: to }, update: { emailVerifiedAt: new Date() }, create: { email: to, emailVerifiedAt: new Date() } })
    : await db.user.upsert({ where: { phone: to }, update: {}, create: { phone: to } });
  return signInUser(user.id);
}

// ── Adding another way to sign in (Settings → You & your security) ───────────

export type LinkState = { step: "start" | "verify"; email?: string; devCode?: string; error?: string; ok?: boolean };

export async function linkEmail(prev: LinkState, form: FormData): Promise<LinkState> {
  const { user } = await requireUser();
  if (form.has("code")) {
    const email = normalizeEmail(String(prev.email ?? ""));
    if (!email) return { step: "start" };
    const bad = await checkCode("email", email, String(form.get("code") ?? "").trim());
    if (bad === "Incorrect code.") return { ...prev, step: "verify", error: bad };
    if (bad) return { step: "start", error: bad };
    const taken = await db.user.findUnique({ where: { email } });
    if (taken && taken.id !== user.id) return { step: "start", error: "That email already belongs to another account." };
    await db.user.update({ where: { id: user.id }, data: { email, emailVerifiedAt: new Date() } });
    revalidatePath("/settings/security");
    return { step: "start", ok: true };
  }
  const email = normalizeEmail(String(form.get("to") ?? ""));
  if (!email) return { step: "start", error: "Enter a valid email address." };
  const taken = await db.user.findUnique({ where: { email } });
  if (taken && taken.id !== user.id) return { step: "start", error: "That email already belongs to another account." };
  const recent = await db.otpCode.count({ where: { email, createdAt: { gt: new Date(Date.now() - 3600_000) } } });
  if (recent >= MAX_CODES_PER_HOUR) return { step: "start", error: "Too many codes requested. Try again in an hour." };
  const code = newOtp();
  await db.otpCode.create({ data: { email, codeHash: hashOtp(keyFor("email", email), code), expiresAt: new Date(Date.now() + OTP_TTL_MS) } });
  const sent = await sendCode("email", email, code);
  return sent.ok ? { step: "verify", email, devCode: sent.devCode } : { step: "start", error: sent.error };
}

/** Removes a way of signing in, as long as at least one other remains. */
export async function unlinkMethod(form: FormData): Promise<void> {
  const { user } = await requireUser();
  const which = String(form.get("which") ?? "");
  const left = [user.phone, user.email, user.googleSub].filter(Boolean).length;
  if (left < 2) return;
  if (which === "google") await db.user.update({ where: { id: user.id }, data: { googleSub: null } });
  revalidatePath("/settings/security");
}

export async function logout() {
  await endSession();
  redirect("/login");
}

// ── App lock (SE-03) ─────────────────────────────────────────────────────────

/** Locks this device now (manual lock, or the idle timer in the browser). */
export async function lockNow(): Promise<void> {
  const s = await readSession();
  if (!s) redirect("/login");
  const user = await db.user.findUnique({ where: { id: s.uid } });
  if (user?.pinHash) await db.session.update({ where: { id: s.sid }, data: { lockedAt: new Date() } });
  redirect(user?.pinHash ? "/lock" : "/dashboard");
}

export async function unlock(_prev: { error?: string }, form: FormData): Promise<{ error?: string }> {
  const s = await readSession();
  if (!s) redirect("/login");
  const user = await db.user.findUnique({ where: { id: s.uid } });
  if (!user?.pinHash) {
    await db.session.update({ where: { id: s.sid }, data: { lockedAt: null } });
    redirect("/dashboard");
  }
  if (verifyPin(String(form.get("pin") ?? ""), user.pinHash)) {
    await db.session.update({ where: { id: s.sid }, data: { lockedAt: null, pinFailures: 0, lastActiveAt: new Date() } });
    redirect("/dashboard");
  }
  const updated = await db.session.update({ where: { id: s.sid }, data: { pinFailures: { increment: 1 } } });
  if (updated.pinFailures >= MAX_PIN_FAILURES) {
    // Too many wrong PINs: sign this device out; signing in again needs the OTP.
    await endSession();
    redirect("/login");
  }
  return { error: `Wrong PIN. ${MAX_PIN_FAILURES - updated.pinFailures} tries left before you are signed out.` };
}

export async function setPin(_prev: { error?: string; ok?: boolean }, form: FormData): Promise<{ error?: string; ok?: boolean }> {
  const { user } = await requireUser();
  const pin = String(form.get("pin") ?? "");
  const confirm = String(form.get("confirm") ?? "");
  const lockAfter = Number(form.get("lockAfterMin") ?? 5);
  if (form.get("remove") === "1") {
    await db.user.update({ where: { id: user.id }, data: { pinHash: null } });
    revalidatePath("/settings/security");
    return { ok: true };
  }
  if (!/^\d{4,6}$/.test(pin)) return { error: "PIN must be 4 to 6 digits" };
  if (pin !== confirm) return { error: "PINs don’t match" };
  if (/^(\d)\1+$/.test(pin) || "0123456789".includes(pin) || "9876543210".includes(pin)) return { error: "Choose a less obvious PIN" };
  if (![1, 5, 15, 60].includes(lockAfter)) return { error: "Choose when to lock" };
  await db.user.update({ where: { id: user.id }, data: { pinHash: hashPin(pin), lockAfterMin: lockAfter } });
  revalidatePath("/settings/security");
  return { ok: true };
}

/** Signs out another device (e.g. a staff member's phone after they leave). */
export async function revokeSession(form: FormData): Promise<void> {
  const { user, session } = await requireUser();
  const id = String(form.get("sessionId") ?? "");
  const where = id === "others" ? { userId: user.id, id: { not: session.sid }, revokedAt: null } : { userId: user.id, id, revokedAt: null };
  await db.session.updateMany({ where, data: { revokedAt: new Date() } });
  revalidatePath("/settings/security");
}

// ── Switching business / branch (LG-12) ──────────────────────────────────────

export async function switchBusiness(form: FormData): Promise<void> {
  const { user, session } = await requireUser();
  const businessId = String(form.get("businessId") ?? "");
  const m = await db.membership.findUnique({ where: { userId_businessId: { userId: user.id, businessId } } });
  if (m) await updateSession(session.sid, { businessId, branchId: null });
  redirect("/dashboard");
}

export async function switchBranch(form: FormData): Promise<void> {
  const { user, session } = await requireUser();
  const branchId = String(form.get("branchId") ?? "") || null;
  if (session.bid) {
    const m = await db.membership.findUnique({ where: { userId_businessId: { userId: user.id, businessId: session.bid } } });
    // Members tied to a branch can't switch; others may pick any branch of this business.
    const ok = m && !m.branchId && (!branchId || (await db.branch.count({ where: { id: branchId, businessId: session.bid } })) > 0);
    if (ok) await updateSession(session.sid, { branchId });
  }
  revalidatePath("/", "layout");
}
