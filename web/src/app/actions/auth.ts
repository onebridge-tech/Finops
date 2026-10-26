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
import { hashPassword, passwordProblem, verifyPassword } from "@/lib/password";
import { clearHits, clientIp, hit, HOUR, limited, MIN } from "@/lib/rate-limit";
import { timingSafeEqual } from "node:crypto";
import { serverAdminEmail } from "@/lib/platform-auth";

// People sign in with their email and password (or Google). A new account proves its email with a
// 6-digit code before it can be used; a forgotten password is reset the same way.

const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const MAX_PIN_FAILURES = 5;

type Purpose = "SIGNUP" | "RESET" | "LINK";
const TOO_MANY = "Too many tries. Please wait a few minutes and try again.";
const devCodes = () => process.env.OTP_DEV_MODE === "1";

/** Sends an email (or prints it in local test mode). */
async function sendEmail(to: string, subject: string, body: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (devCodes()) {
    console.log(`[dev] email to ${to}: ${subject}`);
    return { ok: true };
  }
  if (isTestMode("EMAIL")) return { ok: false, error: "Email is not set up yet, so we can't send the code. Please contact support." };
  const r = await deliver({ channel: "EMAIL", to, kind: "OTP", lang: "en", params: [], subject, body });
  return r.ok ? { ok: true } : { ok: false, error: "Couldn't send the email. Please try again." };
}

/** Makes a new 6-digit code for this email and purpose and emails it. Earlier unused codes for it stop working. */
async function sendCode(email: string, purpose: Purpose): Promise<{ ok: true; devCode?: string } | { ok: false; error: string }> {
  const code = newOtp();
  await db.otpCode.updateMany({ where: { email, purpose, consumedAt: null }, data: { consumedAt: new Date() } });
  await db.otpCode.create({ data: { email, purpose, codeHash: hashOtp(`${purpose}:${email}`, code), expiresAt: new Date(Date.now() + OTP_TTL_MS) } });
  const what = purpose === "RESET" ? "reset your password" : purpose === "LINK" ? "add this email to your account" : "finish creating your account";
  const sent = await sendEmail(email, `${BRAND.NAME} code: ${code}`,
    `Your ${BRAND.NAME} code is ${code}.\n\nUse it to ${what}. It expires in 10 minutes.\n\nIf you did not ask for this, you can ignore this email. Nobody can get into your account without the code.`);
  if (!sent.ok) return sent;
  return devCodes() ? { ok: true, devCode: code } : { ok: true };
}

/** Checks a code and uses it up. Returns an error message, or null when the code was right. */
async function checkCode(email: string, purpose: Purpose, code: string): Promise<string | null> {
  const otp = await db.otpCode.findFirst({ where: { email, purpose, consumedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" } });
  if (!otp || otp.attempts >= MAX_ATTEMPTS) return "That code has expired. Ask for a new one.";
  const want = Buffer.from(otp.codeHash), got = Buffer.from(hashOtp(`${purpose}:${email}`, code));
  if (want.length !== got.length || !timingSafeEqual(want, got)) {
    await db.otpCode.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
    return otp.attempts + 1 >= MAX_ATTEMPTS ? "That code has expired. Ask for a new one." : "That code is not right.";
  }
  await db.otpCode.update({ where: { id: otp.id }, data: { consumedAt: new Date() } });
  return null;
}

/** May another code go to this email now? Limits per address and per visitor. */
async function codeLimited(email: string, ip: string): Promise<boolean> {
  return limited({ key: `code:email:${email}`, max: 5, windowMs: HOUR }, { key: `code:ip:${ip}`, max: 15, windowMs: HOUR });
}

async function passwordChangedNotice(email: string) {
  await sendEmail(email, `Your ${BRAND.NAME} password was changed`,
    `The password for your ${BRAND.NAME} account (${email}) was just changed, and other devices were signed out.\n\nIf this was not you, reset your password now from the sign-in page and contact support.`).catch(() => undefined);
}

// ── Sign in ───────────────────────────────────────────────────────────────────

export type SignInState = { error?: string };

const WRONG = "That email and password don't match. Check them, or reset your password.";

export async function signIn(_prev: SignInState, form: FormData): Promise<SignInState> {
  const email = normalizeEmail(String(form.get("email") ?? ""));
  const password = String(form.get("password") ?? "");
  if (!email || !password) return { error: "Enter your email and password." };
  const ip = await clientIp();
  const ipKey = `login:ip:${ip}`, emailKey = `login:email:${email}`;
  // 5 wrong tries for one account, or 30 from one place, in 15 minutes: wait.
  if (await limited({ key: emailKey, max: 5, windowMs: 15 * MIN }, { key: ipKey, max: 30, windowMs: 15 * MIN })) return { error: TOO_MANY };

  const user = await db.user.findFirst({ where: { email } });
  const ok = await verifyPassword(password, user?.passwordHash); // runs even with no user, so timing gives nothing away
  if (!user || !ok) {
    await hit(emailKey, ipKey);
    return { error: WRONG };
  }
  if (!user.emailVerifiedAt) return { error: "Please finish creating your account: create it again with this email to get a new code." };
  await clearHits(emailKey);
  return signInUser(user.id);
}

// ── Create an account ─────────────────────────────────────────────────────────

export type RegisterState = { step: "form" | "verify"; email?: string; devCode?: string; error?: string; info?: string };

export async function register(prev: RegisterState, form: FormData): Promise<RegisterState> {
  const ip = await clientIp();

  if (form.has("code") || form.has("resend")) {
    const email = normalizeEmail(String(prev.email ?? ""));
    if (!email) return { step: "form" };
    if (form.has("resend")) {
      if (await codeLimited(email, ip)) return { ...prev, error: TOO_MANY, info: undefined };
      await hit(`code:email:${email}`, `code:ip:${ip}`);
      const pending = await db.user.findFirst({ where: { email, emailVerifiedAt: null } });
      if (!pending) return { ...prev, error: undefined, info: "We sent a new code." }; // say the same either way
      const sent = await sendCode(email, "SIGNUP");
      return sent.ok ? { ...prev, devCode: sent.devCode ?? prev.devCode, error: undefined, info: "We sent a new code." } : { ...prev, error: sent.error };
    }
    if (await limited({ key: `verify:ip:${ip}`, max: 30, windowMs: 15 * MIN })) return { ...prev, error: TOO_MANY };
    await hit(`verify:ip:${ip}`);
    const bad = await checkCode(email, "SIGNUP", String(form.get("code") ?? "").trim());
    if (bad) return { ...prev, error: bad, info: undefined };
    const user = await db.user.findFirst({ where: { email, emailVerifiedAt: null } });
    if (!user) return { step: "form", error: "This account is already set up. Sign in instead." };
    await db.user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date() } });
    return signInUser(user.id);
  }

  const name = String(form.get("name") ?? "").trim().slice(0, 80);
  const email = normalizeEmail(String(form.get("email") ?? ""));
  const mobile = normalizeIndianMobile(String(form.get("mobile") ?? ""));
  const password = String(form.get("password") ?? "");
  if (!name) return { step: "form", error: "Enter your name." };
  if (!email) return { step: "form", error: "Enter a valid email address." };
  if (!mobile) return { step: "form", error: "Enter a valid 10-digit mobile number." };
  const problem = passwordProblem(password, email);
  if (problem) return { step: "form", error: problem };
  if (password !== String(form.get("confirm") ?? "")) return { step: "form", error: "The two passwords don't match." };
  if (form.get("terms") !== "on") return { step: "form", error: "Please accept the Terms of Use and Privacy Policy." };
  if (await codeLimited(email, ip)) return { step: "form", error: TOO_MANY };
  await hit(`code:email:${email}`, `code:ip:${ip}`);

  const existing = await db.user.findFirst({ where: { email } });
  if (existing?.emailVerifiedAt) {
    // Don't reveal that the address is taken: tell its owner by email, show the same next step here.
    await sendEmail(email, `You already have a ${BRAND.NAME} account`,
      `Someone (maybe you) tried to create a ${BRAND.NAME} account with ${email}, but this address already has one.\n\nSign in with your password, or use "Forgot password" on the sign-in page to set a new one. If this was not you, you can ignore this email.`);
    return { step: "verify", email };
  }
  // A new address, or one that was never verified (an earlier unfinished sign-up, or a staff invite): set it up now.
  const data = { name: existing?.name ?? name, mobile, passwordHash: await hashPassword(password), passwordChangedAt: new Date() };
  if (existing) await db.user.update({ where: { id: existing.id }, data });
  else await db.user.create({ data: { ...data, email } });
  const sent = await sendCode(email, "SIGNUP");
  return sent.ok ? { step: "verify", email, devCode: sent.devCode } : { step: "form", error: sent.error };
}

// ── Forgot password ───────────────────────────────────────────────────────────

export type ResetState = { step: "email" | "verify"; email?: string; devCode?: string; error?: string; info?: string };

export async function resetPassword(prev: ResetState, form: FormData): Promise<ResetState> {
  const ip = await clientIp();
  if (prev.step === "verify" && form.has("code")) {
    const email = normalizeEmail(String(prev.email ?? ""));
    if (!email) return { step: "email" };
    const password = String(form.get("password") ?? "");
    const problem = passwordProblem(password, email);
    if (problem) return { ...prev, error: problem, info: undefined };
    if (password !== String(form.get("confirm") ?? "")) return { ...prev, error: "The two passwords don't match.", info: undefined };
    if (await limited({ key: `verify:ip:${ip}`, max: 30, windowMs: 15 * MIN })) return { ...prev, error: TOO_MANY };
    await hit(`verify:ip:${ip}`);
    const bad = await checkCode(email, "RESET", String(form.get("code") ?? "").trim());
    if (bad) return { ...prev, error: bad, info: undefined };
    const user = await db.user.findFirst({ where: { email, emailVerifiedAt: { not: null } } });
    if (!user) return { step: "email", error: "That code has expired. Ask for a new one." };
    await db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(password), passwordChangedAt: new Date() } });
    await db.session.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } });
    await clearHits(`login:email:${email}`);
    await passwordChangedNotice(email);
    return signInUser(user.id);
  }

  const email = normalizeEmail(String(form.get("email") ?? prev.email ?? ""));
  if (!email) return { step: "email", error: "Enter a valid email address." };
  if (await codeLimited(email, ip)) return { step: prev.step, email, error: TOO_MANY };
  await hit(`code:email:${email}`, `code:ip:${ip}`);
  const user = await db.user.findFirst({ where: { email, emailVerifiedAt: { not: null } } });
  let devCode: string | undefined;
  if (user && email !== serverAdminEmail()) { // the server admin's password lives in the server settings
    const sent = await sendCode(email, "RESET");
    if (!sent.ok) return { step: "email", email, error: sent.error };
    devCode = sent.devCode;
  }
  // The same answer whether or not the address has an account.
  return { step: "verify", email, devCode, info: `If ${email} has a ${BRAND.NAME} account, we've emailed it a 6-digit code.` };
}

// ── Password and email from Settings → You & your security ────────────────────

export type PasswordState = { error?: string; ok?: boolean };

export async function changePassword(_prev: PasswordState, form: FormData): Promise<PasswordState> {
  const { user, session } = await requireUser();
  if (!user.email || !user.emailVerifiedAt) return { error: "Add and verify your email first. You sign in with your email and password." };
  if (user.email === serverAdminEmail()) return { error: "This admin's password is set on the server (PLATFORM_ADMIN_PASSWORD). Change it there and restart." };
  const ip = await clientIp();
  const key = `pwchange:user:${user.id}`;
  if (await limited({ key, max: 5, windowMs: 15 * MIN }, { key: `pwchange:ip:${ip}`, max: 20, windowMs: 15 * MIN })) return { error: TOO_MANY };
  if (user.passwordHash && !(await verifyPassword(String(form.get("current") ?? ""), user.passwordHash))) {
    await hit(key, `pwchange:ip:${ip}`);
    return { error: "Your current password is not right." };
  }
  const password = String(form.get("password") ?? "");
  const problem = passwordProblem(password, user.email);
  if (problem) return { error: problem };
  if (password !== String(form.get("confirm") ?? "")) return { error: "The two passwords don't match." };
  await db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(password), passwordChangedAt: new Date() } });
  // A changed password signs out every other device.
  await db.session.updateMany({ where: { userId: user.id, id: { not: session.sid }, revokedAt: null }, data: { revokedAt: new Date() } });
  await passwordChangedNotice(user.email);
  revalidatePath("/settings/security");
  return { ok: true };
}

export type LinkState = { step: "start" | "verify"; email?: string; devCode?: string; error?: string; ok?: boolean };

/** Adds a verified email to an older account that signed in by phone, so it can use a password from now on. */
export async function linkEmail(prev: LinkState, form: FormData): Promise<LinkState> {
  const { user } = await requireUser();
  const ip = await clientIp();
  if (form.has("code")) {
    const email = normalizeEmail(String(prev.email ?? ""));
    if (!email) return { step: "start" };
    const bad = await checkCode(email, "LINK", String(form.get("code") ?? "").trim());
    if (bad) return { ...prev, step: "verify", error: bad };
    const taken = await db.user.findFirst({ where: { email } });
    if (taken && taken.id !== user.id) return { step: "start", error: "That email already belongs to another account." };
    await db.user.update({ where: { id: user.id }, data: { email, emailVerifiedAt: new Date() } });
    revalidatePath("/settings/security");
    return { step: "start", ok: true };
  }
  const email = normalizeEmail(String(form.get("to") ?? ""));
  if (!email) return { step: "start", error: "Enter a valid email address." };
  const taken = await db.user.findFirst({ where: { email } });
  if (taken && taken.id !== user.id) return { step: "start", error: "That email already belongs to another account." };
  if (await codeLimited(email, ip)) return { step: "start", error: TOO_MANY };
  await hit(`code:email:${email}`, `code:ip:${ip}`);
  const sent = await sendCode(email, "LINK");
  return sent.ok ? { step: "verify", email, devCode: sent.devCode } : { step: "start", error: sent.error };
}

/** Removes a way of signing in, as long as at least one other remains. */
export async function unlinkMethod(form: FormData): Promise<void> {
  const { user } = await requireUser();
  const which = String(form.get("which") ?? "");
  // Keep a way back in: Google can go only while a verified email with a password remains.
  if (!(user.emailVerifiedAt && user.passwordHash)) return;
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
    // Too many wrong PINs: sign this device out; signing in again needs the password.
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
