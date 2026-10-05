import { redirect } from "next/navigation";
import { readSession } from "@/lib/session";
import { LinkButton } from "@/components/ui";

export default async function Home() {
  if (await readSession()) redirect("/dashboard");
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-4 py-16">
      <p className="text-sm font-semibold uppercase tracking-wide text-brand">Ledger · Billing · Collections</p>
      <h1 className="mt-3 text-4xl font-bold leading-tight sm:text-5xl">Know who owes you. Get paid faster.</h1>
      <p className="mt-4 max-w-xl text-lg text-muted">
        Record credit with every customer and supplier, send GST invoices, and collect payments with WhatsApp reminders and UPI — from any phone or computer.
      </p>
      <ul className="mt-8 grid gap-3 text-sm sm:grid-cols-3">
        {[
          ["Digital khata", "You gave / You got, running balance, branded statements."],
          ["Reminders + UPI", "One-tap WhatsApp reminder with a pay link."],
          ["GST invoices", "CGST/SGST/IGST done right, shared with “Pay now”."],
        ].map(([t, d]) => (
          <li key={t} className="rounded-xl border border-line bg-card p-4">
            <p className="font-semibold">{t}</p>
            <p className="mt-1 text-muted">{d}</p>
          </li>
        ))}
      </ul>
      <div className="mt-8">
        <LinkButton href="/login" className="px-6 py-3 text-base">Start free</LinkButton>
      </div>
    </main>
  );
}
