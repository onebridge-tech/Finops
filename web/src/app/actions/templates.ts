"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireBusiness } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { checkTemplate, TEMPLATE_KINDS, type MessageKind } from "@/lib/messaging/templates";
import { UI_LANGUAGES } from "@/lib/i18n";

export type TemplateState = { error?: string; ok?: boolean };

const text = (f: FormData, k: string) => String(f.get(k) ?? "");

function parse(form: FormData) {
  const kind = text(form, "kind") as MessageKind;
  const lang = text(form, "lang");
  if (!TEMPLATE_KINDS.some((k) => k.kind === kind) || !(lang in UI_LANGUAGES)) return null;
  return { kind, lang };
}

export async function saveTemplate(_prev: TemplateState, form: FormData): Promise<TemplateState> {
  const ctx = await requireBusiness("settings:write");
  const key = parse(form);
  if (!key) return { error: "Unknown message." };
  const body = text(form, "body").trim();
  const bad = checkTemplate(body);
  if (bad) return { error: bad };
  await db.$transaction(async (tx) => {
    const row = await tx.messageTemplate.upsert({
      where: { businessId_kind_lang: { businessId: ctx.business.id, ...key } },
      update: { body, updatedById: ctx.user.id },
      create: { businessId: ctx.business.id, ...key, body, updatedById: ctx.user.id },
    });
    await audit(tx, { businessId: ctx.business.id, actorId: ctx.user.id, action: "save_template", entity: "MessageTemplate", entityId: row.id, data: key });
  });
  revalidatePath("/settings/templates");
  return { ok: true };
}

export async function resetTemplate(_prev: TemplateState, form: FormData): Promise<TemplateState> {
  const ctx = await requireBusiness("settings:write");
  const key = parse(form);
  if (!key) return { error: "Unknown message." };
  await db.messageTemplate.deleteMany({ where: { businessId: ctx.business.id, ...key } });
  revalidatePath("/settings/templates");
  return { ok: true };
}
