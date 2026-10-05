import "server-only";
import { isValidGstin, normalizeGstin } from "./gstin";

// GSTIN lookup (IN-06). Set GSTIN_PROVIDER=appyflow with APPYFLOW_KEY for live
// data from the GST portal; without it the lookup runs in TEST mode and returns
// made-up details (clearly marked) derived from the number itself.

export type GstinDetails = {
  gstin: string;
  legalName: string;
  tradeName: string | null;
  address: string | null;
  stateCode: string;
  status: string | null; // Active, Cancelled, Suspended…
  test: boolean;
};

export type LookupResult = { ok: true; details: GstinDetails } | { ok: false; error: string };

const CONSTITUTION: Record<string, string> = { C: "Private Limited", P: "Enterprises", H: "HUF", F: "Partners", A: "Association", T: "Trust" };

export async function lookupGstinDetails(input: string): Promise<LookupResult> {
  const gstin = normalizeGstin(input);
  if (!isValidGstin(gstin)) return { ok: false, error: "GSTIN is not valid" };
  const provider = process.env.GSTIN_PROVIDER;
  if (provider === "appyflow") return appyflow(gstin);
  if (provider) return { ok: false, error: `Unknown GSTIN provider "${provider}"` };

  const pan = gstin.slice(2, 12);
  return {
    ok: true,
    details: {
      gstin, stateCode: gstin.slice(0, 2), test: true, status: "Active",
      legalName: `Test ${CONSTITUTION[pan[3]] ?? "Traders"} ${pan.slice(0, 5)}`,
      tradeName: null,
      address: null,
    },
  };
}

async function appyflow(gstin: string): Promise<LookupResult> {
  const key = process.env.APPYFLOW_KEY;
  if (!key) return { ok: false, error: "APPYFLOW_KEY is not set" };
  try {
    const res = await fetch(`https://appyflow.in/api/verifyGST?gstNo=${gstin}&key_secret=${encodeURIComponent(key)}`, { signal: AbortSignal.timeout(10_000) });
    const data = (await res.json()) as {
      error?: boolean; message?: string;
      taxpayerInfo?: { lgnm?: string; tradeNam?: string; sts?: string; pradr?: { addr?: Record<string, string | undefined> } };
    };
    const t = data.taxpayerInfo;
    if (!res.ok || data.error || !t?.lgnm) return { ok: false, error: data.message ?? "GSTIN not found" };
    const a = t.pradr?.addr ?? {};
    const address = [a.bno, a.flno, a.bnm, a.st, a.loc, a.dst, a.pncd].filter(Boolean).join(", ") || null;
    return { ok: true, details: { gstin, legalName: t.lgnm, tradeName: t.tradeNam || null, address, stateCode: gstin.slice(0, 2), status: t.sts ?? null, test: false } };
  } catch {
    return { ok: false, error: "GSTIN lookup is not reachable right now" };
  }
}
