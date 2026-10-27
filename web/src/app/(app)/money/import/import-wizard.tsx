"use client";

import { startTransition, useActionState, useState, type FormEvent } from "react";
import { commitStatement, previewStatement, repreviewStatement, type StatementPreview, type StatementResult } from "@/app/actions/money";
import { FIELDS } from "@/lib/bank-import";
import { Badge, Card, ErrorText, Field, Input, Select, buttonClass } from "@/components/ui";
import { DataNotice } from "@/components/data-notice";
import { Icon } from "@/components/icon";
import { formatINR } from "@/lib/money";

async function step(prev: StatementPreview, form: FormData): Promise<StatementPreview> {
  return form.has("rows") ? repreviewStatement(prev, form) : previewStatement(prev, form);
}

const PDF_PROBLEM = {
  scanned: "This PDF is a scanned picture of a statement, so there is no text in it to read. Download the statement from your bank’s website or app instead (PDF, Excel or CSV).",
  "no-table": "We couldn’t find the table of transactions in this PDF (a line with Date, Description and the amount columns). Try the Excel or CSV download from your bank instead.",
  broken: "This file couldn’t be opened as a PDF. It may be damaged; download it again from your bank.",
} as const;

/** Add a statement: choose the file, check the columns were understood, then import. */
export function ImportWizard() {
  const [p, action, pending] = useActionState<StatementPreview, FormData>(step, {});
  const [done, commit, committing] = useActionState<StatementResult, FormData>(commitStatement, {});
  // A locked PDF: the password lives only in this component's memory, never in a form field that is sent.
  const [locked, setLocked] = useState<"password" | "wrong-password" | null>(null);
  const [password, setPassword] = useState("");
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const [balanceChecked, setBalanceChecked] = useState(false);
  const mapped = p.mapping ?? {};
  const t = p.totals;
  const busy = pending || opening;

  async function read(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setPdfError(null);
    setBalanceChecked(false);
    const file = new FormData(form).get("file");
    if (!(file instanceof File) || file.size === 0) return setPdfError("Choose your statement file");
    if (!/\.pdf$/i.test(file.name) && file.type !== "application/pdf") {
      setLocked(null);
      return startTransition(() => action(new FormData(form)));
    }
    setOpening(true);
    try {
      const { readPdfStatement } = await import("@/components/pdf-statement");
      const r = await readPdfStatement(file, password);
      if (!r.ok) {
        if (r.reason === "password" || r.reason === "wrong-password") setLocked(r.reason);
        else { setLocked(null); setPdfError(PDF_PROBLEM[r.reason]); }
        return;
      }
      setLocked(null);
      setPassword("");
      // Only the rows go to the server. The PDF and its password stay on this device.
      const out = new FormData();
      out.set("pdfTable", JSON.stringify(r.table));
      out.set("fileName", file.name);
      startTransition(() => action(out));
    } catch {
      setPdfError(PDF_PROBLEM.broken);
    } finally {
      setOpening(false);
    }
  }

  return (
    <div className="space-y-5">
      <Card>
        <form onSubmit={read} className="space-y-3">
          <Field label="Statement file" hint="PDF, Excel (.xlsx) or CSV, as downloaded from your bank’s website or app.">
            <input type="file" name="file" accept=".pdf,application/pdf,.csv,.xlsx,.xls,.txt" required onChange={() => { setLocked(null); setPassword(""); setPdfError(null); }} className="block w-full rounded-lg border border-line bg-card px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-brand-soft file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-brand" />
          </Field>

          {locked && (
            <div className="space-y-3 rounded-lg border border-brand/30 bg-brand-soft/40 p-3 sm:p-4">
              <div className="flex gap-2.5">
                <Icon name="lock" size={20} className="mt-0.5 shrink-0 text-brand" />
                <div>
                  <p className="font-medium">This statement is locked with a password</p>
                  <p className="text-sm text-muted">Banks lock statements so only the account holder can open them. Type the password your bank gave you. The email the statement came with usually explains it (for example, part of your name with your date of birth, or your customer ID).</p>
                </div>
              </div>
              <Field label="Statement password">
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="off" autoFocus spellCheck={false} aria-describedby="pdf-password-promise" />
              </Field>
              {locked === "wrong-password" && <p role="alert" className="text-sm text-gave">That password didn’t open the file. Check it against your bank’s email and try again.</p>}
              <div id="pdf-password-promise" className="rounded-lg border border-line bg-card px-3 py-2.5 text-sm">
                <p className="font-medium">Your password stays on this device</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-5 text-muted">
                  <li>It is used <b>only to open this file</b>, here in your browser. Nothing more.</li>
                  <li>It is <b>never sent to us</b> and <b>never saved</b>, not on our servers and not on this phone or computer.</li>
                  <li>The PDF itself is not uploaded either. Only the transactions you check on the next screen are added to your account.</li>
                  <li>As soon as the file is read, it is closed and the password is forgotten. Next time you will be asked again.</li>
                </ul>
              </div>
            </div>
          )}

          <ErrorText>{pdfError ?? p.error}</ErrorText>
          <button className={buttonClass("primary")} disabled={busy || (!!locked && !password)}>
            {opening ? "Opening…" : pending ? "Reading…" : locked ? "Open with this password" : p.rows ? "Choose another file" : "Read the file"}
          </button>
          <DataNotice
            why="Your bank statement lets the app sort your income and spending and match payments to your customers and bills."
            keep="The transactions you add, for as long as you keep this shop on FinOps, until you delete the statement or your account. The statement file is not kept: a PDF is read on your device and never uploaded; an Excel or CSV file is read once and thrown away."
            shared="You and the team members you allow to see money. Never sold, never used for advertising."
          />
        </form>
      </Card>

      {p.rows && p.header && t && (
        <form className="space-y-5">
          <input type="hidden" name="header" value={JSON.stringify(p.header)} />
          <input type="hidden" name="rows" value={JSON.stringify(p.rows)} />
          <input type="hidden" name="fileName" value={p.fileName ?? ""} />
          {p.fromPdf && <input type="hidden" name="fromPdf" value="1" />}
          {balanceChecked && <input type="hidden" name="balanceChecked" value="1" />}

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
                {p.balance && p.balance.mismatches.length === 0 && (
                  <p role="status" className="rounded-lg bg-got/10 px-3 py-2 text-sm text-got">Every balance adds up: we checked all {p.balance.checked + 1} rows against the Balance column, so none was missed or misread.</p>
                )}
                {p.balance && p.balance.mismatches.length > 0 && (
                  <div role="alert" className="space-y-2 rounded-lg border border-warn/30 bg-warn/10 px-3 py-2.5 text-sm">
                    <p className="font-medium text-warn">{p.balance.mismatches.length} balance{p.balance.mismatches.length === 1 ? " doesn’t" : "s don’t"} add up</p>
                    <p className="text-muted">The balance on {p.balance.mismatches.length === 1 ? "this row" : "these rows"} is not the one before it plus money in, minus money out. A row may have been missed or an amount misread{p.fromPdf ? " while reading the PDF" : ""}. Compare {p.balance.mismatches.length === 1 ? "it" : "them"} with your statement before adding.</p>
                    <ul className="space-y-0.5 text-xs">
                      {p.balance.mismatches.slice(0, 10).map((m, i) => (
                        <li key={i}>{m.date} · {m.description.slice(0, 50)} · {m.direction === "IN" ? "+" : "−"}{formatINR(m.amountPaise)}: balance shown {formatINR(m.shownPaise)}, expected {formatINR(m.expectedPaise)}</li>
                      ))}
                    </ul>
                    <label className="flex items-start gap-2"><input type="checkbox" className="mt-0.5" checked={balanceChecked} onChange={(e) => setBalanceChecked(e.target.checked)} /> I’ve compared these rows with my statement and want to add it anyway.</label>
                  </div>
                )}
                {p.balance === null && p.fromPdf && <p className="rounded-lg bg-warn/10 px-3 py-2 text-sm text-warn">This statement has no Balance column, so we couldn’t check every row was read. Compare the totals above with your statement before adding.</p>}
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
              <button formAction={commit} className={buttonClass("primary")} disabled={committing || (!!p.balance && p.balance.mismatches.length > 0 && !balanceChecked)}>{committing ? "Adding…" : `Add ${t.count - t.duplicates} transactions`}</button>
            </Card>
          )}
        </form>
      )}
    </div>
  );
}
