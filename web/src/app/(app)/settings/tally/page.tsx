import Link from "next/link";
import { requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import { pendingVouchers } from "@/lib/tally";
import { dismissTallyConflict, removeTallyKey, retryTallyFailures } from "@/app/actions/tally";
import { Card, PageHeader, buttonClass } from "@/components/ui";
import { KeyPanel } from "./key-panel";

export const metadata = { title: "Connect to Tally" };

const when = (d: Date) => d.toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" });

export default async function TallyPage() {
  const ctx = await requireBusiness("settings:write");
  const b = ctx.business;
  const [logs, waiting] = await Promise.all([
    db.tallySync.findMany({ where: { businessId: b.id }, orderBy: { createdAt: "desc" }, take: 100 }),
    pendingVouchers(b.id, 500),
  ]);
  const conflicts = logs.filter((l) => l.status === "CONFLICT");
  const failed = logs.filter((l) => l.status === "FAILED");
  return (
    <>
      <PageHeader title="Connect to Tally" sub="Sends your bills, receipts and return notes to Tally, and reads your customers, items and pending amounts back." action={<Link href="/settings" className="text-base text-muted underline">← Settings</Link>} />
      <div className="space-y-5">
        <section className="space-y-2">
          <h2 className="font-semibold">1. Connector key</h2>
          <KeyPanel hasKey={!!b.tallyKeyHash} />
          {b.tallyKeyHash && <form action={removeTallyKey}><button className="text-base text-muted underline">Turn the connector off</button></form>}
        </section>
        <section className="space-y-2">
          <h2 className="font-semibold">2. Install the agent on the Tally computer</h2>
          <Card className="space-y-2 text-base">
            <p>Download <a className="text-brand underline" href="/tally-agent.mjs" download>tally-agent.mjs</a> (needs Node.js 18 or newer), open Tally’s connectivity settings and let it act as a server on port 9000, then run the agent with your site address, key and exact company name. The instructions are at the top of the file.</p>
            <p className="text-muted">These ledgers must exist in the Tally company: Sales, Sales Returns, Output CGST, Output SGST, Output IGST, Round Off, Cash, Bank Account. Customers must exist as ledgers with the same name as here.</p>
            <p className="text-muted">Debit notes and orders are not sent yet.</p>
          </Card>
        </section>
        <section className="space-y-2">
          <h2 className="font-semibold">Status</h2>
          <Card className="grid gap-2 text-base sm:grid-cols-4">
            <p><span className="block text-sm text-muted">Last contact</span>{b.tallyLastSyncAt ? when(b.tallyLastSyncAt) : "Never"}</p>
            <p><span className="block text-sm text-muted">Waiting to send</span>{waiting.length}</p>
            <p><span className="block text-sm text-muted">Failed</span><span className={failed.length ? "text-gave" : ""}>{failed.length}</span></p>
            <p><span className="block text-sm text-muted">To review</span><span className={conflicts.length ? "text-gave" : ""}>{conflicts.length}</span></p>
          </Card>
          {failed.length > 0 && <form action={retryTallyFailures}><button className={buttonClass("secondary")}>Try the failed ones again</button></form>}
        </section>
        {conflicts.length > 0 && (
          <section className="space-y-2">
            <h2 className="font-semibold">Differences to review</h2>
            <Card className="divide-y divide-line p-0 text-base">
              {conflicts.map((c) => (
                <form key={c.id} action={dismissTallyConflict} className="flex items-center justify-between gap-3 px-4 py-2">
                  <input type="hidden" name="id" value={c.id} />
                  <span>{c.message}<span className="block text-sm text-muted">{c.kind.toLowerCase()} · {when(c.createdAt)}</span></span>
                  <button className={buttonClass("secondary")}>Done</button>
                </form>
              ))}
            </Card>
            <p className="text-sm text-muted">Nothing is overwritten automatically. Fix whichever side is wrong, then press Done.</p>
          </section>
        )}
        <section className="space-y-2">
          <h2 className="font-semibold">Sync log</h2>
          <Card className="divide-y divide-line p-0 text-base">
            {logs.length === 0 && <p className="px-4 py-3 text-muted">Nothing has synced yet.</p>}
            {logs.map((l) => (
              <div key={l.id} className="flex justify-between gap-3 px-4 py-2">
                <span>{l.direction === "PUSH" ? "→ Tally" : "← Tally"} · {l.kind.toLowerCase()}<span className="block text-sm text-muted">{l.message}</span></span>
                <span className="text-right text-sm"><span className={l.status === "OK" ? "text-got" : "text-gave"}>{l.status === "OK" ? "OK" : l.status === "FAILED" ? `Failed (try ${l.retries})` : "Review"}</span><span className="block text-muted">{when(l.createdAt)}</span></span>
              </div>
            ))}
          </Card>
        </section>
      </div>
    </>
  );
}
