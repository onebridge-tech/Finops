import { redirect } from "next/navigation";
import { readSession } from "@/lib/session";
import { BRAND } from "@/lib/brand";
import { Icon, Logo, type IconName } from "@/components/icon";
import { Avatar, LinkButton } from "@/components/ui";
import { UI_LANGUAGES } from "@/lib/i18n";
import { LegalLinks } from "@/components/legal-page";
import { LEGAL } from "@/lib/legal";

const STEPS: [IconName, string, string][] = [
  ["note", "Write it down", "Add a customer and type what they took on credit. It takes a few seconds."],
  ["send", "Ask for the money", "One tap sends a WhatsApp message with the amount and a link to pay by UPI."],
  ["bill", "Make a proper bill", "GST bills with your shop name, ready to share. The tax is worked out for you."],
];

const SAMPLE = [
  ["Lakshmi General Stores", "₹12,400", "bad"],
  ["Ravi Tea Traders", "₹4,100", "bad"],
  ["Sri Kirana", "₹850", "bad"],
] as const;

export default async function Home() {
  if (await readSession()) redirect("/dashboard");
  return (
    <main className="mx-auto min-h-screen max-w-5xl px-5">
      <header className="flex items-center justify-between py-5">
        <span className="flex items-center gap-2 text-lg font-semibold tracking-tight"><Logo size={30} />{BRAND.NAME}</span>
        <LinkButton href="/login" variant="secondary">Sign in</LinkButton>
      </header>

      <section className="grid items-center gap-10 py-12 sm:py-20 lg:grid-cols-2">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1 text-xs font-medium text-brand">
            <Icon name="check" size={13} />Free to start. Works on any phone
          </span>
          <h1 className="mt-4 text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">Know who owes you. Get paid faster.</h1>
          <p className="mt-4 max-w-md text-base text-muted">{BRAND.ABOUT}</p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <LinkButton href="/login" className="px-5 py-2.5 text-[15px]">Start free</LinkButton>
            <span className="text-sm text-muted">Only your mobile number. Takes two minutes.</span>
          </div>
        </div>

        {/* A small picture of the product, made from the same parts the app uses. */}
        <div className="rounded-2xl border border-line bg-card p-4 shadow-[var(--shadow-lg)]" aria-hidden>
          <div className="flex items-center justify-between px-1 pb-3">
            <span className="text-sm font-semibold">Money to get</span>
            <span className="text-xl font-semibold tabular-nums text-gave">₹17,350</span>
          </div>
          <div className="divide-y divide-line rounded-xl border border-line">
            {SAMPLE.map(([name, amount]) => (
              <div key={name} className="flex items-center gap-3 px-3 py-2.5">
                <Avatar name={name} />
                <span className="flex-1 truncate text-sm font-medium">{name}</span>
                <span className="text-sm font-semibold tabular-nums text-gave">{amount}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-got/10 px-3 py-2.5 text-sm text-got">
            <Icon name="send" size={16} />Reminder sent to Ravi Tea Traders on WhatsApp
          </div>
          <p className="mt-3 text-center text-xs text-muted">Example, not real data</p>
        </div>
      </section>

      <section aria-labelledby="how" className="pb-16">
        <h2 id="how" className="text-xl font-semibold tracking-tight">How it works</h2>
        <ol className="mt-5 grid gap-4 sm:grid-cols-3">
          {STEPS.map(([icon, title, body], i) => (
            <li key={title} className="rounded-xl border border-line bg-card p-5 shadow-[var(--shadow)]">
              <span className="flex size-10 items-center justify-center rounded-lg bg-brand-soft text-brand"><Icon name={icon} size={20} /></span>
              <h3 className="mt-4 font-semibold">{i + 1}. {title}</h3>
              <p className="mt-1 text-sm text-muted">{body}</p>
            </li>
          ))}
        </ol>
      </section>

      <footer className="space-y-3 border-t border-line py-6 text-sm text-muted">
        <p>Available in {Object.values(UI_LANGUAGES).join(" · ")}.</p>
        <LegalLinks />
        <p className="text-xs">© {new Date().getFullYear()} {LEGAL.COMPANY}</p>
      </footer>
    </main>
  );
}
