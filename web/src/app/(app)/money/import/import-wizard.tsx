"use client";

import { useActionState } from "react";
import { commitStatement, previewStatement, repreviewStatement, type StatementPreview, type StatementResult } from "@/app/actions/money";
import { FIELDS } from "@/lib/bank-import";
import { Badge, Card, ErrorText, Field, Input, Select, buttonClass } from "@/components/ui";
import { formatINR } from "@/lib/money";

async function step(prev: StatementPreview, form: FormData): Promise<StatementPreview> {
  return form.has("rows") ? repreviewStatement(prev, form) : previewStatement(prev, form);
}

/** Add a statement: choose the file, check the columns were understood, then import. */
export function ImportWizard() {
  const [p, action, pending] = useActionState<StatementPreview, FormData>(step, {});
  const [done, commit, committing] = useActionState<StatementResult, FormData>(commitStatement, {});
  const mapped = p.mapping ?? {};
  const t = p.totals;

  return (
    <div className="space-y-5">
      <Card>
        <form action={action} className="space-y-3">
          <Field label="Statement file" hint="Excel (.xlsx) or CSV from your bank’s website or app. PDFs can’t be read yet.">
            <input type="file" name="file" accept=".csv,.xlsx,.xls,.txt" required className="block w-full rounded-lg border border-line bg-card px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-brand-soft file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-brand" />
          </Field>
          <ErrorText>{p.error}</ErrorText>
          <button className={buttonClass("primary")} disabled={pending}>{pending ? "Reading…" : p.rows ? "Choose another file" : "Read the file"}</button>
        </form>
      </Card>

      {p.rows && p.header && t && (
        <form className="space-y-5">
          <input type="hidden" name="header" value={JSON.stringify(p.header)} />
          <input type="hidden" name="rows" value={JSON.stringify(p.rows)} />
          <input type="hidden" name="fileName" value={p.fileName ?? ""} />

          <Card className="space-y-4">
            <div>
              <h2 className="font-semibold">1. Check the columns</h2>
              <p className="text-sm text-muted">We matched your columns by their names. Fix any that are wrong, then press “Check again”.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {FIELDS.map((f) => (
                <Field key={f.key} label={f.label + ("required" in f && f.required ? " *" : "")}>
                  <Select name={`map_${f.key}`} defaultValue={mapped[f.key] === undefined ? "" : String(mapped[f.key])} key={`${f.key}-${mapped[f.key] ?? "none"}`}>
                    <option value="">— not in my file —</option>
                    {p.header!.map((h, i) => <option key={i} value={i}>{h || `(column ${i + 1})`}</option>)}
                  </Select>
                </Field>
              ))}
            </div>
            <button formAction={action} className={buttonClass("secondary")} disabled={pending}>Check again</button>
          </Card>

          <Card className="space-y-3">
            <h2 className="font-semibold">2. What we found</h2>
            {t.count === 0 ? (
              <p className="text-sm text-gave">No transactions could be read with these columns. Check the Date and amount columns above.</p>
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-4">
                  <div><p className="text-xs text-muted">Transactions</p><p className="text-xl font-semibold tabular-nums">{t.count}</p></div>
                  <div><p className="text-xs text-muted">Money in</p><p className="text-xl font-semibold tabular-nums text-got">{formatINR(t.inPaise)}</p></div>
                  <div><p className="text-xs text-muted">Money out</p><p className="text-xl font-semibold tabular-nums text-gave">{formatINR(t.outPaise)}</p></div>
                  <div><p className="text-xs text-muted">Dates</p><p className="text-sm font-medium">{t.from} to {t.to}</p></div>
                </div>
                {t.duplicates > 0 && <p className="rounded-lg bg-warn/10 px-3 py-2 text-sm text-warn">{t.duplicates} of these are already in your account from an earlier statement. They will be skipped, not counted twice.</p>}
                {t.errors.length > 0 && (
                  <details className="rounded-lg border border-line px-3 py-2 text-sm">
                    <summary className="cursor-pointer text-muted">{t.errors.length} row{t.errors.length === 1 ? "" : "s"} could not be read and will be left out</summary>
                    <ul className="mt-2 space-y-0.5 text-xs text-muted">{t.errors.map((e) => <li key={e.row}>Row {e.row}: {e.reason}</li>)}</ul>
                  </details>
                )}
                <div className="overflow-x-auto rounded-lg border border-line">
                  <table className="w-full min-w-[520px] text-sm">
                    <thead className="bg-bg/50 text-left text-xs font-medium text-muted"><tr><th className="px-3 py-2">Date</th><th className="px-3 py-2">Description</th><th className="px-3 py-2">Group we guessed</th><th className="px-3 py-2 text-right">Amount</th></tr></thead>
                    <tbody className="divide-y divide-line">
                      {p.sample?.map((s, i) => (
                        <tr key={i}>
                          <td className="whitespace-nowrap px-3 py-2">{s.date}</td>
                          <td className="max-w-[16rem] truncate px-3 py-2">{s.description}</td>
                          <td className="px-3 py-2"><Badge>{s.category}</Badge></td>
                          <td className={`px-3 py-2 text-right tabular-nums ${s.direction === "IN" ? "text-got" : "text-gave"}`}>{s.direction === "IN" ? "+" : "−"}{formatINR(s.amountPaise)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-muted">Showing the first {p.sample?.length}. You can change any group after importing, and the app remembers your choice.</p>
              </>
            )}
          </Card>

          {t.count > 0 && (
            <Card className="space-y-3">
              <h2 className="font-semibold">3. Add it</h2>
              <Field label="Name for this statement (optional)"><Input name="name" placeholder="e.g. HDFC current account, October" /></Field>
              <ErrorText>{done.error}</ErrorText>
              <button formAction={commit} className={buttonClass("primary")} disabled={committing}>{committing ? "Adding…" : `Add ${t.count - t.duplicates} transactions`}</button>
            </Card>
          )}
        </form>
      )}
    </div>
  );
}
