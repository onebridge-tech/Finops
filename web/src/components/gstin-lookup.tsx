"use client";

import { useState } from "react";
import { lookupGstin } from "@/app/actions/gstin";

/**
 * "Fetch details" button for a GSTIN field. Fills the form's name, address and
 * state fields (by name) from the GST registration; never overwrites a name
 * the user already typed.
 */
export function GstinLookupButton() {
  const [pending, setPending] = useState(false);
  const [note, setNote] = useState<{ text: string; tone: "error" | "info" } | null>(null);

  const run = async (e: React.MouseEvent<HTMLButtonElement>) => {
    const form = e.currentTarget.form;
    const field = (n: string) => form?.elements.namedItem(n) as HTMLInputElement | HTMLSelectElement | null;
    const gstin = field("gstin")?.value.trim();
    if (!gstin) return setNote({ text: "Enter a GSTIN first", tone: "error" });
    setPending(true);
    setNote(null);
    const r = await lookupGstin(gstin);
    setPending(false);
    if (!r.ok) return setNote({ text: r.error, tone: "error" });
    const d = r.details;
    const name = field("name");
    if (name && !name.value) name.value = d.tradeName ?? d.legalName;
    const address = field("address");
    if (address && !address.value && d.address) address.value = d.address;
    const state = field("stateCode");
    if (state) state.value = d.stateCode;
    setNote({
      text: `${d.legalName}${d.status ? ` · ${d.status}` : ""}${d.test ? " · TEST DATA (no lookup provider configured)" : ""}`,
      tone: d.status && d.status !== "Active" ? "error" : "info",
    });
  };

  return (
    <>
      <button type="button" onClick={run} disabled={pending}
        className="shrink-0 rounded-lg border border-line bg-card px-3 py-2 text-base font-medium hover:bg-bg disabled:opacity-50">
        {pending ? "Fetching…" : "Fetch details"}
      </button>
      {note && <span className={`block basis-full text-sm ${note.tone === "error" ? "text-gave" : "text-muted"}`}>{note.text}</span>}
    </>
  );
}
