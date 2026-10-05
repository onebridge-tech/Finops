"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { clearSession, hashOtp, newOtp, writeSession } from "@/lib/session";
import { normalizeIndianMobile } from "@/lib/share";

export type OtpState = { step: "phone" | "verify"; phone?: string; devCode?: string; error?: string };

const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const MAX_CODES_PER_HOUR = 5;

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
  // TODO(Phase 1 launch): send via DLT-registered SMS / WhatsApp OTP provider.
  return { step: "phone", error: "SMS delivery is not configured yet." };
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
  await writeSession({ uid: user.id, bid: first?.businessId });
  redirect(first ? "/dashboard" : "/onboarding");
}

export async function logout() {
  await clearSession();
  redirect("/login");
}
