import Link from "next/link";
import { can, requireBusiness } from "@/lib/auth";
import { listBackups } from "@/lib/backup";
import { EXPORTS, type ExportName } from "@/lib/exports";
import { MORE_KINDS, type MoreKind } from "@/lib/import-more";
import type { ImportKind } from "@/lib/import-rows";
import { Card, PageHeader, fmtDate } from "@/components/ui";
import { Icon } from "@/components/icon";
import { ImportWizard } from "./import-wizard";
import { BackupButton } from "./backup-button";

export const metadata = { title: "Excel & backup" };

const LABEL: Record<ExportName, string> = {
  parties: "Customers & suppliers with balances", entries: "All ledger entries", items: "Items", invoices: "Sales bills (GST summary)", quotes: "Price quotes", receipts: "Receipts",
  purchases: "Supplier bills", expenses: "Shop expenses", stock: "Stock on hand", cashsales: "Cash sales (no name)", pricelists: "Special prices", notes: "Return & extra charge notes",
  orders: "Orders", cashbook: "Cash adjustments", banklines: "Bank statement lines",
};

type Kind = { kind: ImportKind; label: string; about: string; allowed: boolean; exportAs: ExportName | null };

const kinds = (role: string): Kind[] => [
  { kind: "parties", label: "Customers & suppliers", about: "Names, mobile numbers, GSTIN and what each owes. Tally and Khatabook exports work as they are.", allowed: can(role, "party:write"), exportAs: "parties" },
  { kind: "items", label: "Items", about: "What you sell: prices, GST rate, HSN and unit.", allowed: can(role, "item:write"), exportAs: "items" },
  ...(Object.keys(MORE_KINDS) as MoreKind[]).map((k) => ({
    kind: k, label: MORE_KINDS[k].label, about: MORE_KINDS[k].about, allowed: can(role, MORE_KINDS[k].permission),
    exportAs: ({ purchases: "purchases", expenses: "expenses", payments: "entries", invoices: "invoices", stock: "stock", cashsales: "cashsales", pricelists: "pricelists" } as Record<MoreKind, ExportName>)[k],
  })),
];

export default async function DataPage({ searchParams }: PageProps<"/data">) {
  const sp = await searchParams;
  const { role } = await requireBusiness();
  const list = kinds(role);
  const chosen = list.find((k) => k.kind === sp.kind && k.allowed) ?? null;
  const tab = sp.tab === "export" ? "export" : "import";
  const backups = role === "OWNER" ? await listBackups() : [];
  const tabs = [["import", "Bring in data"], ["export", "Download & backup"]] as const;

  return (
    <>
      <PageHeader title="Excel & backup" sub="Bring in your old lists from Excel. Download any list or all your data, any time." />
      <nav className="mb-5 flex w-fit max-w-full flex-wrap gap-1 rounded-lg bg-line/50 p-1">
        {tabs.map(([t, label]) => (
          <Link key={t} href={`/data?tab=${t}`} className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${tab === t ? "bg-card text-ink shadow-sm" : "text-muted hover:text-ink"}`}>{label}</Link>
        ))}
      </nav>

      {tab === "import" && !chosen && (
        <>
          <p className="mb-3 text-sm text-muted">What do you want to bring in? Each one takes an Excel (.xlsx) or CSV file, shows you a preview, and skips rows that are wrong or already in the app.</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {list.filter((k) => k.allowed).map((k) => (
              <Link key={k.kind} href={`/data?tab=import&kind=${k.kind}`}>
                <Card className="h-full p-4 transition hover:border-brand/40 hover:shadow-md sm:p-4">
                  <span className="flex items-center gap-2 font-semibold"><span className="flex size-8 items-center justify-center rounded-lg bg-brand-soft text-brand"><Icon name="download" size={16} className="rotate-180" /></span>{k.label}</span>
                  <span className="mt-1.5 block text-[13px] leading-snug text-muted">{k.about}</span>
                </Card>
              </Link>
            ))}
          </div>
          <Card className="mt-4 flex flex-wrap items-center gap-3 text-sm">
            <Icon name="note" size={18} className="text-brand" />
            <span className="min-w-0 flex-1"><span className="font-medium">Paper notes?</span> <span className="text-muted">Take a photo and we read the items and amounts for you.</span></span>
            <Link href="/paper-notes" className="font-medium text-brand underline">Read a paper note</Link>
          </Card>
        </>
      )}

      {tab === "import" && chosen && (
        <div className="space-y-4">
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <Link href="/data?tab=import" className="text-muted hover:text-ink">← All imports</Link>
            <span className="font-semibold">{chosen.label}</span>
            <a href={`/import-template/${chosen.kind}`} className="font-medium text-brand underline">Download the Excel template</a>
            {chosen.exportAs && <a href={`/export/${chosen.exportAs}?format=xlsx`} className="font-medium text-brand underline">Download what is in the app now</a>}
          </p>
          <ImportWizard kind={chosen.kind} />
        </div>
      )}

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
            {can(role, "reports:view") && (
              <Card className="space-y-2 text-sm">
                <h2 className="text-base font-semibold tracking-tight">For your accountant</h2>
                <p className="text-muted">The whole financial year in one Excel file, and your GST return figures for any month.</p>
                <span className="flex flex-wrap gap-4"><Link href="/reports/year-end" className="font-medium text-brand underline">Year-end pack & tax estimate</Link><Link href="/reports/gst" className="font-medium text-brand underline">GST returns</Link></span>
              </Card>
            )}
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
