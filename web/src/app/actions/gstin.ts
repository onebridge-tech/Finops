"use server";

import { requireUser } from "@/lib/auth";
import { lookupGstinDetails, type LookupResult } from "@/lib/gstin-lookup";

/** GSTIN lookup for the party form and business onboarding (IN-06). */
export async function lookupGstin(gstin: string): Promise<LookupResult> {
  await requireUser();
  return lookupGstinDetails(gstin);
}
