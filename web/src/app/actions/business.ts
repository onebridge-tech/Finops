"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireBusiness, requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { updateSession } from "@/lib/session";
import { isValidGstin, normalizeGstin, STATES } from "@/lib/gstin";
import { isValidUpiId } from "@/lib/share";
import { WELCOME_CREDITS } from "@/lib/credits";
import { checkUpload, saveUpload } from "@/lib/files";

export type FormState = { error?: string; ok?: boolean };

const BusinessInput = z.object({
  name: z.string().trim().min(2, "Business name is required"),
  gstin: z.string().trim().transform(normalizeGstin).refine((v) => v === "" || isValidGstin(v), "GSTIN is not valid"),
  stateCode: z.string().refine((v) => v in STATES, "Select your state"),
  address: z.string().trim().max(300),
  phone: z.string().trim().max(20),
  email: z.string().trim().max(120),
  upiId: z.string().trim().refine((v) => v === "" || isValidUpiId(v), "UPI ID looks wrong (e.g. shop@okicici)"),
  invoicePrefix: z.string().trim().max(10).optional(),
});

function parse(form: FormData) {
  const raw = Object.fromEntries(["name", "gstin", "stateCode", "address", "phone", "email", "upiId", "invoicePrefix"].map((k) => [k, String(form.get(k) ?? "")]));
  const r = BusinessInput.safeParse(raw);
  if (!r.success) return { error: r.error.issues[0].message } as const;
  const d = r.data;
  // GSTIN determines the state of registration.
  if (d.gstin && d.gstin.slice(0, 2) !== d.stateCode) return { error: "State does not match the GSTIN state code" } as const;
  return {
    data: {
      name: d.name,
      gstin: d.gstin || null,
      stateCode: d.stateCode,
      address: d.address || null,
      phone: d.phone || null,
      email: d.email || null,
      upiId: d.upiId || null,
      ...(d.invoicePrefix ? { invoicePrefix: d.invoicePrefix } : {}),
    },
  } as const;
}

export async function createBusiness(_prev: FormState, form: FormData): Promise<FormState> {
  const { user, session } = await requireUser();
  const p = parse(form);
  if ("error" in p) return { error: p.error };

  const business = await db.$transaction(async (tx) => {
    const b = await tx.business.create({
      data: { ...p.data, creditBalance: WELCOME_CREDITS, memberships: { create: { userId: user.id, role: "OWNER" } } },
    });
    await tx.creditTxn.create({ data: { businessId: b.id, delta: WELCOME_CREDITS, balanceAfter: WELCOME_CREDITS, reason: "WELCOME", userId: user.id } });
    await audit(tx, { businessId: b.id, actorId: user.id, action: "create", entity: "Business", entityId: b.id, data: p.data });
    return b;
  });
  await updateSession(session.sid, { businessId: business.id, branchId: null });
  redirect("/dashboard");
}

const BrandingInput = z.object({
  brandColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Pick a colour"),
  docTemplate: z.enum(["CLASSIC", "MODERN", "COMPACT"]),
  docTerms: z.string().trim().max(1000),
  quotePrefix: z.string().trim().min(1).max(10),
  bankName: z.string().trim().max(80),
  bankAccountName: z.string().trim().max(80),
  bankAccountNo: z.string().trim().refine((v) => v === "" || /^\d{6,18}$/.test(v), "Account number should be 6–18 digits"),
  bankIfsc: z.string().trim().toUpperCase().refine((v) => v === "" || /^[A-Z]{4}0[A-Z0-9]{6}$/.test(v), "IFSC looks wrong (e.g. HDFC0001234)"),
});

/** Logo, signature, colours, layout, terms and bank details on documents (BD-04). */
export async function updateBranding(_prev: FormState, form: FormData): Promise<FormState> {
  const { user, business } = await requireBusiness("settings:write");
  const r = BrandingInput.safeParse(Object.fromEntries(Object.keys(BrandingInput.shape).map((k) => [k, String(form.get(k) ?? "")])));
  if (!r.success) return { error: r.error.issues[0].message };
  const d = r.data;
  if ((d.bankAccountNo === "") !== (d.bankIfsc === "")) return { error: "Enter both the account number and IFSC, or neither" };

  const uploads = [["logo", "LOGO", "logoFileId"], ["signature", "SIGNATURE", "signatureFileId"]] as const;
  // Check every file before storing any, so a bad second file leaves no orphan.
  for (const [field, kind] of uploads) {
    const f = form.get(field);
    const err = f instanceof File && f.size > 0 ? await checkUpload(f, kind) : null;
    if (err) return { error: `${field === "logo" ? "Logo" : "Signature"}: ${err}` };
  }
  const files: { logoFileId?: string | null; signatureFileId?: string | null } = {};
  for (const [field, kind, key] of uploads) {
    const f = form.get(field);
    if (f instanceof File && f.size > 0) {
      const saved = await saveUpload(f, { businessId: business.id, userId: user.id, kind });
      if (!saved.ok) return { error: `${field === "logo" ? "Logo" : "Signature"}: ${saved.error}` };
      files[key] = saved.id;
    } else if (form.get(`remove_${field}`) === "on") {
      files[key] = null;
    }
  }
  const data = {
    brandColor: d.brandColor, docTemplate: d.docTemplate, docTerms: d.docTerms || null, quotePrefix: d.quotePrefix,
    bankName: d.bankName || null, bankAccountName: d.bankAccountName || null, bankAccountNo: d.bankAccountNo || null, bankIfsc: d.bankIfsc || null,
    ...files,
  };
  await db.$transaction(async (tx) => {
    await tx.business.update({ where: { id: business.id }, data });
    await audit(tx, { businessId: business.id, actorId: user.id, action: "update", entity: "Business", entityId: business.id, data });
  });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updateBusiness(_prev: FormState, form: FormData): Promise<FormState> {
  const { user, business } = await requireBusiness("settings:write");
  const p = parse(form);
  if ("error" in p) return { error: p.error };
  await db.$transaction(async (tx) => {
    await tx.business.update({ where: { id: business.id }, data: p.data });
    await audit(tx, { businessId: business.id, actorId: user.id, action: "update", entity: "Business", entityId: business.id, data: p.data });
  });
  revalidatePath("/", "layout");
  return { ok: true };
}
