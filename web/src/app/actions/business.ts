"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireBusiness, requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { writeSession } from "@/lib/session";
import { isValidGstin, normalizeGstin, STATES } from "@/lib/gstin";
import { isValidUpiId } from "@/lib/share";

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
    const b = await tx.business.create({ data: { ...p.data, memberships: { create: { userId: user.id, role: "OWNER" } } } });
    await audit(tx, { businessId: b.id, actorId: user.id, action: "create", entity: "Business", entityId: b.id, data: p.data });
    return b;
  });
  await writeSession({ uid: session.uid, bid: business.id });
  redirect("/dashboard");
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
