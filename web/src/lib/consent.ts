import "server-only";
import type { Party } from "@prisma/client";
import { db } from "./db";
import type { Channel } from "./reminder-rule";

// Messaging consent under the DPDP Act and TRAI rules (SE-06). Every change is
// stored as a ConsentEvent; the Party columns hold the current state.

type Source = "BUSINESS_ATTESTED" | "PUBLIC_LINK" | "PROVIDER";

const COLUMN: Record<Channel, "whatsappOptOutAt" | "smsOptOutAt" | "emailOptOutAt"> = {
  WHATSAPP: "whatsappOptOutAt", SMS: "smsOptOutAt", EMAIL: "emailOptOutAt",
};

export async function recordConsent(party: Pick<Party, "id" | "businessId">, actorId: string) {
  await db.$transaction([
    db.party.update({ where: { id: party.id }, data: { consentAt: new Date() } }),
    db.consentEvent.create({ data: { businessId: party.businessId, partyId: party.id, channel: "ALL", action: "GRANTED", source: "BUSINESS_ATTESTED", actorId } }),
  ]);
}

export async function recordOptOut(party: Pick<Party, "id" | "businessId">, channel: Channel | "ALL", source: Source, actorId?: string) {
  const now = new Date();
  const data = channel === "ALL" ? { whatsappOptOutAt: now, smsOptOutAt: now, emailOptOutAt: now } : { [COLUMN[channel]]: now };
  await db.$transaction([
    db.party.update({ where: { id: party.id }, data }),
    db.consentEvent.create({ data: { businessId: party.businessId, partyId: party.id, channel, action: "OPTED_OUT", source, actorId } }),
  ]);
}

export async function recordOptIn(party: Pick<Party, "id" | "businessId">, channel: Channel | "ALL", source: Source, actorId?: string) {
  const data = channel === "ALL" ? { whatsappOptOutAt: null, smsOptOutAt: null, emailOptOutAt: null } : { [COLUMN[channel]]: null };
  await db.$transaction([
    db.party.update({ where: { id: party.id }, data }),
    db.consentEvent.create({ data: { businessId: party.businessId, partyId: party.id, channel, action: "OPTED_IN", source, actorId } }),
  ]);
}
