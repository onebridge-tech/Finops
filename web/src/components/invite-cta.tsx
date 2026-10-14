import { inviteUrl } from "@/lib/referral";

/** "Keep your own khata" prompt on shared pages (EC-03). Server component. */
export async function InviteCta({ businessId, businessName }: { businessId: string; businessName: string }) {
  const url = await inviteUrl(businessId);
  return (
    <aside className="no-print mt-8 rounded-xl border border-brand/30 bg-brand/5 p-4 text-center text-sm">
      <p className="font-medium">{businessName} keeps this account digitally. You can too — free.</p>
      <p className="mt-1 text-muted">Track what customers owe you, send WhatsApp reminders and GST invoices from your phone.</p>
      <a href={url} className="mt-3 inline-block rounded-lg bg-brand px-4 py-2 font-medium text-brand-ink">Start your free ledger</a>
    </aside>
  );
}
