// Messaging credits (CP-12). One credit ≈ ₹0.50; email and in-app delivery are free.
import type { Channel } from "./reminder-rule";

export const CREDIT_COST: Record<Channel, number> = { WHATSAPP: 1, SMS: 1, EMAIL: 0 };

export const WELCOME_CREDITS = 50;

export const CREDIT_PACKS = [
  { id: "starter", credits: 400, pricePaise: 19900 },
  { id: "growth", credits: 2200, pricePaise: 99900 },
  { id: "volume", credits: 5000, pricePaise: 199900 },
] as const;
