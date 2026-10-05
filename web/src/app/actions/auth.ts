"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { endSession, hashOtp, hashPin, newOtp, readSession, startSession, updateSession, verifyPin } from "@/lib/session";
import { normalizeIndianMobile } from "@/lib/share";
import { deliver, isTestMode } from "@/lib/messaging/providers";

export type OtpState = { step: "phone" | "verify"; phone?: string; devCode?: string; error?: string };

const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const MAX_CODES_PER_HOUR = 5;
const MAX_PIN_FAILURES = 5;

async function requestOtp(_prev: OtpState, form: FormData): Promise<OtpState> {
  const phone = normalizeIndianMobile(String(form.get("phone") ?? ""));
  if (!phone) return { step: "phone", error: "Enter a valid 10-digit Indian mobile number." };

  const recent = await db.otpCode.count({ where: { phone, createdAt: { gt: new Date(Date.now() - 3600_000) } } });
  if (recent >= MAX_CODES_PER_HOUR) return { step: "phone", error: "Too many codes requested. Try again in an hour." };

  const code = newOtp();
  await db.otpCode.create({ data: { phone, codeHash: hashOtp(phone, code), expiresAt: new Date(Date.now() + OTP_TTL_MS) } });

  if (process.env.OTP_DEV_MODE === "1") {
    console.log(`[dev] OTP for ${phone}: ${code}`);
    return { step: "verify", phone, devCode: code };
  }
  if (isTestMode("SMS")) return { step: "phone", error: "SMS delivery is not configured yet." };
  const r = await deliver({ channel: "SMS", to: phone, kind: "OTP", lang: "en", params: [code], subject: "", body: `${code} is your login code. It expires in 10 minutes.` });
  return r.ok ? { step: "verify", phone } : { step: "phone", error: "Couldn’t send the code. Please try again." };
}

/** Single entry point for the login form: requests a code, or verifies one if `code` is present. */
export async function login(prev: OtpState, form: FormData): Promise<OtpState> {
  return form.has("code") ? verifyOtp(prev, form) : requestOtp(prev, form);
}

async function verifyOtp(prev: OtpState, form: FormData): Promise<OtpState> {
  const phone = normalizeIndianMobile(String(form.get("phone") ?? ""));
  const code = String(form.get("code") ?? "").trim();
  if (!phone) return { step: "phone" };

  const otp = await db.otpCode.findFirst({
    where: { phone, consumedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!otp || otp.attempts >= MAX_ATTEMPTS) return { step: "phone", error: "Code expired. Request a new one." };

  if (otp.codeHash !== hashOtp(phone, code)) {
    await db.otpCode.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
    return { ...prev, step: "verify", phone, error: "Incorrect code." };
  }
  await db.otpCode.update({ where: { id: otp.id }, data: { consumedAt: new Date() } });

  const user = await db.user.upsert({ where: { phone }, update: {}, create: { phone } });
  const first = await db.membership.findFirst({ where: { userId: user.id }, orderBy: { createdAt: "asc" } });
  await startSession(user.id, first?.businessId);
  redirect(first ? "/dashboard" : "/onboarding");
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
