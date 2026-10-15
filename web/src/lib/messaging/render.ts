import "server-only";
import { db } from "../db";
import { fillTemplate, renderMessage, type MessageKind, type TemplateVars } from "./templates";

/** The message for a customer: the shop's own wording if it has changed it, otherwise the built-in text. */
export async function renderFor(businessId: string, kind: MessageKind, lang: string, vars: TemplateVars, optOutUrl?: string): Promise<string> {
  const custom = await db.messageTemplate.findUnique({ where: { businessId_kind_lang: { businessId, kind, lang } } });
  if (!custom) return renderMessage(kind, lang, vars, optOutUrl);
  const body = fillTemplate(custom.body, lang, vars);
  return optOutUrl ? `${body}\nStop messages: ${optOutUrl}` : body;
}
