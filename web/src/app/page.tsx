import { redirect } from "next/navigation";
import { readSession } from "@/lib/session";
import { BRAND } from "@/lib/brand";
import { Logo } from "@/components/icon";
import { LinkButton } from "@/components/ui";
import { UI_LANGUAGES } from "@/lib/i18n";

const STEPS = [
  ["Write it down", "Add a customer and type what they took on credit. Takes five seconds. No more notebook."],
  ["Ask for the money", "Tap once. A WhatsApp message goes to them with the amount and a UPI link to pay you."],
  ["Make a proper bill", "GST bills with your shop name, ready to share. Tax is worked out for you."],
] as const;

export default async function Home() {
  if (await readSession()) redirect("/dashboard");
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col px-5 py-8 sm:py-12">
      <header className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-xl font-bold"><Logo size={34} />{BRAND.NAME}</span>
        <LinkButton href="/login" variant="secondary">Sign in</LinkButton>
      </header>

      <section className="my-auto py-12">
        <h1 className="text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">Who owes you money? {BRAND.NAME} remembers.</h1>
        <p className="mt-5 text-xl text-muted">{BRAND.ABOUT}</p>
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <LinkButton href="/login" className="min-h-14 px-8 text-lg">Start free</LinkButton>
          <span className="text-base text-muted">Takes about two minutes. Only your mobile number.</span>
        </div>
      </section>

      <section aria-labelledby="how">
        <h2 id="how" className="text-2xl font-bold">How it works</h2>
        <ol className="mt-4 divide-y divide-line border-y border-line">
          {STEPS.map(([title, body], i) => (
            <li key={title} className="flex gap-4 py-5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand text-lg font-bold text-brand-ink" aria-hidden>{i + 1}</span>
              <div>
                <h3 className="text-lg font-bold">{title}</h3>
                <p className="mt-1 text-base text-muted">{body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <footer className="mt-10 text-base text-muted">
        <p>Use it in {Object.values(UI_LANGUAGES).join(" · ")}. Works on any phone, tablet or computer.</p>
      </footer>
    </main>
  );
}
