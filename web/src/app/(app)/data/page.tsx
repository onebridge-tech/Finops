import Link from "next/link";
import { can, requireBusiness } from "@/lib/auth";
import { listBackups } from "@/lib/backup";
import { EXPORTS } from "@/lib/exports";
import { Card, PageHeader, fmtDate } from "@/components/ui";
import { ImportWizard } from "./import-wizard";
import { BackupButton } from "./backup-button";

export const metadata = { title: "Excel & backup" };

const LABEL: Record<(typeof EXPORTS)[number], string> = {
  parties: "Parties with balances", entries: "All ledger entries", items: "Items", invoices: "Invoices (GST summary)", quotes: "Quotations", receipts: "Receipts",
};

export default async function DataPage({ searchParams }: PageProps<"/data">) {
  const tab = (await searchParams).tab === "items" ? "items" : (await searchParams).tab === "export" ? "export" : "parties";
  const { role } = await requireBusiness();
  const backups = role === "OWNER" ? await listBackups() : [];
  const tabs = [["parties", "Import parties"], ["items", "Import items"], ["export", "Export & backup"]] as const;

  return (
    <>
      <PageHeader title="Excel & backup" sub="Bring in your old list from Excel. Download all your data any time." />
      <nav className="mb-5 flex w-fit max-w-full flex-wrap gap-1 rounded-lg bg-line/50 p-1">
        {tabs.map(([t, label]) => (
          <Link key={t} href={`/data?tab=${t}`} className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${tab === t ? "bg-card text-ink shadow-sm" : "text-muted hover:text-ink"}`}>{label}</Link>
        ))}
      </nav>

      {tab === "parties" && (can(role, "party:write") ? <ImportWizard kind="parties" /> : <p className="text-sm text-muted">You don’t have permission to add parties.</p>)}
      {tab === "items" && (can(role, "item:write") ? <ImportWizard kind="items" /> : <p className="text-sm text-muted">You don’t have permission to add items.</p>)}

      {tab === "export" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="divide-y divide-line p-0 text-sm">
            {EXPORTS.map((e) => (
              <div key={e} className="flex items-center justify-between gap-3 px-4 py-3">
                <span>{LABEL[e]}</span>
                <span className="flex gap-3 text-xs">
                  {(["xlsx", "csv", "json"] as const).map((f) => <a key={f} href={`/export/${e}?format=${f}`} className="text-brand underline">{f === "xlsx" ? "Excel" : f.toUpperCase()}</a>)}
                </span>
              </div>
            ))}
          </Card>
          <div className="space-y-6">
            {can(role, "settings:write") && (
              <Card className="space-y-2 text-sm">
                <h2 className="text-base font-semibold tracking-tight">Full export</h2>
                <p className="text-muted">All your data and all your uploaded files in one ZIP file. Yours to keep.</p>
                <a href="/export/all" download className="inline-block rounded-lg bg-brand px-3.5 py-2 font-medium text-brand-ink">Download full export (.zip)</a>
              </Card>
            )}
            {role === "OWNER" && (
              <Card className="space-y-3 text-sm">
                <h2 className="text-base font-semibold tracking-tight">Automatic backups</h2>
                <p className="text-muted">Uploaded photos and files are copied every day. Your database is backed up by your hosting provider; the full download above is a copy you can keep yourself.</p>
                <BackupButton />
                {backups.length > 0 && (
                  <ul className="divide-y divide-line text-xs">
                    {backups.slice(0, 7).map((b) => (
                      <li key={b.name} className="flex justify-between py-1.5">
                        <span>{fmtDate(b.at)} {b.at.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" })}{b.name.endsWith(".enc") && " · encrypted"}</span>
                        <span className="text-muted">{Math.round(b.bytes / 1024)} KB</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            )}
          </div>
        </div>
      )}
    </>
  );
}
