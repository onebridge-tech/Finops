import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { publicConsent } from "@/app/actions/messaging";

// Public opt-out page linked from every message (SE-06). No login.
export const metadata = { title: "Message preferences", robots: { index: false } };

const CHANNELS = [
  ["WHATSAPP", "WhatsApp", "whatsappOptOutAt"],
  ["SMS", "SMS", "smsOptOutAt"],
  ["EMAIL", "Email", "emailOptOutAt"],
] as const;

export default async function MessagePreferences({ params }: PageProps<"/o/[token]">) {
  const { token } = await params;
  const party = await db.party.findUnique({ where: { shareToken: token }, include: { business: { select: { name: true } } } });
  if (!party) notFound();

  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <p className="text-xs uppercase tracking-wide text-muted">Message preferences</p>
      <h1 className="mt-1 text-xl font-bold">Messages from {party.business.name}</h1>
      <p className="mt-2 text-sm text-muted">
        Choose how {party.business.name} can send you reminders, receipts and invoices. Stopping messages does not change what you owe or are owed.
      </p>
      <ul className="mt-6 divide-y divide-line rounded-xl border border-line bg-card">
        {CHANNELS.map(([channel, label, column]) => {
          const off = !!party[column];
          return (
            <li key={channel} className="flex items-center justify-between px-4 py-3 text-sm">
              <span>
                {label} <span className={`ml-1 text-xs ${off ? "text-gave" : "text-got"}`}>{off ? "stopped" : "on"}</span>
              </span>
              <form action={publicConsent}>
                <input type="hidden" name="token" value={token} />
                <input type="hidden" name="channel" value={channel} />
                <input type="hidden" name="action" value={off ? "in" : "out"} />
                <button className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium hover:bg-bg">{off ? "Turn back on" : "Stop"}</button>
              </form>
            </li>
          );
        })}
      </ul>
      <form action={publicConsent} className="mt-4">
        <input type="hidden" name="token" value={token} />
        <input type="hidden" name="channel" value="ALL" />
        <input type="hidden" name="action" value="out" />
        <button className="text-sm text-muted underline hover:text-ink">Stop all messages</button>
      </form>
    </main>
  );
}
