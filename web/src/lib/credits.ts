// Messaging credits (CP-12). One credit ≈ ₹0.50. SMS costs a credit; email is free, and WhatsApp is free because
// messages are opened in the shop's own WhatsApp (click-to-chat), not sent through the paid WhatsApp API.
import type { Channel } from "./reminder-rule";

export const CREDIT_COST: Record<Channel, number> = { WHATSAPP: 0, SMS: 1, EMAIL: 0 };

export const WELCOME_CREDITS = 50;

export const CREDIT_PACKS = [
  { id: "starter", credits: 400, pricePaise: 19900 },
  { id: "growth", credits: 2200, pricePaise: 99900 },
  { id: "volume", credits: 5000, pricePaise: 199900 },
] as const;
