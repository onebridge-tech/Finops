"use client";

import { useActionState, useState } from "react";
import { ActionForm } from "@/components/action-form";
import { commitImport, previewImport, type PreviewState } from "@/app/actions/data";
import { Card, ErrorText, Select, buttonClass } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { FIELDS, guessMapping, type ImportKind } from "@/lib/import-rows";
import { toCsv } from "@/lib/csv";

type Table = { header: string[]; rows: string[][]; mapping: Record<string, number> };

type ContactsManager = { select: (props: string[], opts: { multiple: boolean }) => Promise<{ name?: string[]; tel?: string[] }[]> };

/** Import parties (with opening balances) or items from Excel/CSV or phone contacts (LG-07, IN-02). */
export function ImportWizard({ kind }: { kind: ImportKind }) {
  const [preview, previewAction, previewPending] = useActionState(previewImport, {} as PreviewState);
  const [local, setLocal] = useState<Table | null>(null);
  const [contactsError, setContactsError] = useState<string | null>(null);
  // Contacts are read in the browser; a file is read on the server.
  const table: Table | null = local ?? (preview.header ? { header: preview.header, rows: preview.rows!, mapping: preview.mapping! } : null);
  const contacts = typeof navigator !== "undefined" && "contacts" in navigator ? (navigator as unknown as { contacts: ContactsManager }).contacts : null;

  const pickContacts = async () => {
    setContactsError(null);
    try {
      const picked = await contacts!.select(["name", "tel"], { multiple: true });
      const rows = picked.filter((c) => c.name?.[0]).map((c) => [c.name![0], c.tel?.[0] ?? ""]);
      if (rows.length === 0) return;
      const header = ["Name", "Mobile"];
      setLocal({ header, rows, mapping: guessMapping("parties", header) });
    } catch {
      setContactsError("Couldn’t read contacts");
    }
  };

  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <ActionForm dispatch={(f) => { setLocal(null); previewAction(f); }} pending={previewPending} className="flex flex-wrap items-center gap-3">
          <input type="hidden" name="kind" value={kind} />
          <input type="file" name="file" accept=".xlsx,.csv,.txt" required className="text-base" />
          <SubmitButton variant="secondary">Read file</SubmitButton>
          {kind === "parties" && contacts && (
            <button type="button" onClick={pickContacts} className={buttonClass("secondary")}>Pick from phone contacts</button>
          )}
        </ActionForm>
        <p className="text-sm text-muted">
          Excel (.xlsx) or CSV with a header row, up to 5,000 rows. {kind === "parties"
            ? "Columns like Name, Mobile, GSTIN, State, Type, Credit days, Opening balance and Dr/Cr are recognised — Tally and Khatabook exports work as they are. A Dr balance (or a plain positive amount) means the party owes you."
            : "Columns like Item name, Sale price, Purchase price, GST %, HSN, Unit and SKU are recognised."}
        </p>
        <ErrorText>{preview.error ?? contactsError}</ErrorText>
      </Card>
      {table && <MapAndImport key={`${table.header.join("|")}:${table.rows.length}`} kind={kind} table={table} />}
    </div>
  );
}

function MapAndImport({ kind, table }: { kind: ImportKind; table: Table }) {
  const [mapping, setMapping] = useState(table.mapping);
  const [result, action, pending] = useActionState(commitImport, {});
  const fields = FIELDS[kind];
  const sample = table.rows.slice(0, 5);
  const cell = (r: string[], key: string) => (mapping[key] === undefined ? "" : r[mapping[key]] ?? "");

  const downloadReport = () => {
    const csv = toCsv(["Row", "Name", "Reason"], (result.skipped ?? []).map((s) => [s.row, s.name, s.reason]));
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "import-errors.csv";
    a.click();
  };

  if (result.imported !== undefined) {
    return (
      <Card className="space-y-3 text-base">
        <p className="text-base font-semibold text-got">Imported {result.imported} {kind === "items" ? "items" : "parties"}.</p>
        {(result.skipped?.length ?? 0) > 0 && (
          <>
            <p>{result.skipped!.length} rows were not imported:</p>
            <div className="max-h-64 overflow-auto rounded-lg border border-line">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card text-left text-muted"><tr><th className="px-3 py-1">Row</th><th className="px-3 py-1">Name</th><th className="px-3 py-1">Reason</th></tr></thead>
                <tbody className="divide-y divide-line">
                  {result.skipped!.map((s) => <tr key={s.row}><td className="px-3 py-1">{s.row}</td><td className="px-3 py-1">{s.name}</td><td className="px-3 py-1 text-gave">{s.reason}</td></tr>)}
                </tbody>
              </table>
            </div>
            <button type="button" onClick={downloadReport} className={buttonClass("secondary")}>Download error report</button>
          </>
        )}
      </Card>
    );
  }

  return (
    <ActionForm dispatch={action} pending={pending} className="space-y-4">
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="rows" value={JSON.stringify(table.rows)} />
      <input type="hidden" name="mapping" value={JSON.stringify(mapping)} />
      <Card className="space-y-3">
        <h3 className="font-semibold">Match your columns · {table.rows.length} rows</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          {fields.map((f) => (
            <label key={f.key} className="space-y-1 text-base">
              <span className="font-medium">{f.label}{f.required && " *"}</span>
              <Select
                value={mapping[f.key] ?? ""}
                onChange={(e) => setMapping((m) => {
                  const next = { ...m };
                  if (e.target.value === "") delete next[f.key];
                  else next[f.key] = Number(e.target.value);
                  return next;
                })}
              >
                <option value="">— not in file —</option>
                {table.header.map((h, i) => <option key={i} value={i}>{h || `Column ${i + 1}`}</option>)}
              </Select>
            </label>
          ))}
        </div>
      </Card>
      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="border-b border-line text-left text-muted">
            <tr>{fields.filter((f) => mapping[f.key] !== undefined).map((f) => <th key={f.key} className="px-3 py-2 font-medium">{f.label}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-line">
            {sample.map((r, i) => (
              <tr key={i}>{fields.filter((f) => mapping[f.key] !== undefined).map((f) => <td key={f.key} className="px-3 py-2">{cell(r, f.key)}</td>)}</tr>
            ))}
          </tbody>
        </table>
        {table.rows.length > sample.length && <p className="px-3 py-2 text-sm text-muted">Showing the first {sample.length} of {table.rows.length} rows.</p>}
      </Card>
      <ErrorText>{result.error}</ErrorText>
      <SubmitButton>Import {table.rows.length} rows</SubmitButton>
      <p className="text-sm text-muted">Rows with problems, and parties or items that already exist, are skipped and listed so you can fix them.</p>
    </ActionForm>
  );
}
