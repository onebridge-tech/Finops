import Link from "next/link";
import { redirect } from "next/navigation";
import { readSession } from "@/lib/session";
import { BRAND } from "@/lib/brand";
import { LEGAL } from "@/lib/legal";
import { Icon, Logo, type IconName } from "@/components/icon";
import { LegalLinks } from "@/components/legal-page";
import { Hero } from "./_landing/hero";
import { Features } from "./_landing/features";
import { Reveal } from "./_landing/motion";
import { LANG_LABEL } from "./_landing/copy";

export const metadata = {
  title: { absolute: `${BRAND.NAME} — ${BRAND.TAGLINE}` },
  description: `${BRAND.ABOUT} In English, తెలుగు, हिन्दी, தமிழ் and ಕನ್ನಡ.`,
};

const BEFORE = [
  "Names and amounts in a notebook that gets lost or smudged",
  "Awkward phone calls to ask for money",
  "Forgetting who promised to pay on Friday",
  "Bills written by hand, tax worked out on a calculator",
  "No idea if the month made a profit",
];
const AFTER = [
  "Every customer’s account in your phone, safe and searchable",
  "A polite WhatsApp reminder, written for you, in one tap",
  "A “calls to make today” list with every promise noted",
  "GST bills with the tax done for you, shared in seconds",
  "Your bank statement turned into profit and loss",
];

const STEPS: [IconName, string, string][] = [
  ["note", "Write it down", "Add a customer and type what they took on credit. It takes a few seconds."],
  ["send", "Ask for the money", "One tap opens WhatsApp with the amount and a link to pay by UPI. You press send."],
  ["rupee", "Get paid", "When they pay, write it down. The balance updates and the reminders stop by themselves."],
];

const SHOPS = ["Tea stalls", "Kirana stores", "Wholesalers", "Hardware shops", "Medical shops", "Tiffin centres", "Distributors", "Garment shops", "Electricals", "Service providers"];

const FAQ: [string, string][] = [
  ["Is it really free?", "Yes. Writing credit, making bills, keeping stock and reminders on WhatsApp are free. Only SMS messages use paid credits, and you can skip those."],
  ["Do my customers need to install anything?", "No. They get a normal WhatsApp message with a link. They can see their account and pay by UPI from it."],
  ["Does it work without internet?", "You can write entries without signal. They upload by themselves when your phone is back online."],
  ["Is my data safe?", "Your records are yours. Each shop’s data is kept separate, every change is recorded, and you can download everything any time from Excel & backup. You can also lock the app with a PIN."],
  ["Which languages does it speak?", `${Object.values(LANG_LABEL).join(", ")}. Change the language any time from the top bar. Your customers’ reminders can be in their own language.`],
  ["Do I need a GST number?", "No. You can use FinOps just for credit and reminders. Add your GST number when you want to make tax bills."],
];

export default async function Home() {
  if (await readSession()) redirect("/dashboard");
  return (
    <div className="min-h-screen overflow-x-clip">
      <noscript><style>{".lp-reveal{opacity:1!important;transform:none!important}"}</style></noscript>

      <header className="sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Link href="/" className="flex items-center gap-2 text-lg font-semibold tracking-tight"><Logo size={32} />{BRAND.NAME}</Link>
          <nav className="flex items-center gap-1.5 sm:gap-3">
            <a href="#how" className="hidden rounded-lg px-3 py-2 text-sm font-medium text-muted hover:text-ink sm:block">How it works</a>
            <a href="#faq" className="hidden rounded-lg px-3 py-2 text-sm font-medium text-muted hover:text-ink sm:block">Questions</a>
            <Link href="/login" className="rounded-lg px-3 py-2 text-sm font-medium hover:bg-card">Sign in</Link>
            <Link href="/login" className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-ink transition hover:opacity-90">Start free</Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5">
        <Hero />

        {/* Before and after: the notebook against FinOps. */}
        <section aria-labelledby="why" className="py-14 sm:py-20">
          <Reveal>
            <h2 id="why" className="max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">Your notebook can’t send a reminder.</h2>
            <p className="mt-3 max-w-xl text-muted sm:text-base">Most shops lose money not because customers refuse to pay, but because nobody asked at the right time.</p>
          </Reveal>
          <div className="mt-10 grid gap-5 lg:grid-cols-2">
            <Reveal>
              <div className="h-full rounded-2xl border border-line bg-card/60 p-6">
                <p className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted">The notebook way</p>
                <ul className="space-y-3.5">
                  {BEFORE.map((b) => (
                    <li key={b} className="flex gap-3 text-muted">
                      <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-gave/15 text-gave text-xs font-bold" aria-hidden>×</span>
                      <span className="line-through decoration-gave/50">{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
            <Reveal delay={150}>
              <div className="h-full rounded-2xl border-2 border-brand bg-card p-6 shadow-[var(--shadow-lg)]">
                <p className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-brand"><Logo size={20} />With {BRAND.NAME}</p>
                <ul className="space-y-3.5">
                  {AFTER.map((a, i) => (
                    <Reveal key={a} delay={250 + i * 120}>
                      <li className="flex gap-3">
                        <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-got/15 text-got"><Icon name="check" size={12} /></span>
                        <span className="font-medium">{a}</span>
                      </li>
                    </Reveal>
                  ))}
                </ul>
              </div>
            </Reveal>
          </div>
        </section>

        <section id="how" aria-labelledby="how-h" className="scroll-mt-20 py-14 sm:py-20">
          <Reveal>
            <h2 id="how-h" className="text-3xl font-semibold tracking-tight sm:text-4xl">Three steps. Two minutes to start.</h2>
          </Reveal>
          <ol className="relative mt-10 grid gap-5 md:grid-cols-3">
            <svg className="pointer-events-none absolute left-[16%] right-[16%] top-9 hidden h-3 w-[68%] md:block" viewBox="0 0 100 2" preserveAspectRatio="none" aria-hidden>
              <line x1="0" y1="1" x2="100" y2="1" stroke="var(--brand)" strokeOpacity="0.4" strokeWidth="2" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
            </svg>
            {STEPS.map(([icon, title, body], i) => (
              <li key={title}>
                <Reveal delay={i * 160}>
                  <div className="relative h-full rounded-2xl border border-line bg-card p-6 shadow-[var(--shadow)]">
                    <span className="flex size-12 items-center justify-center rounded-xl bg-brand text-brand-ink"><Icon name={icon} size={22} /></span>
                    <span className="absolute right-5 top-5 text-5xl font-semibold text-line" aria-hidden>{i + 1}</span>
                    <h3 className="mt-5 text-lg font-semibold">{title}</h3>
                    <p className="mt-1.5 text-muted">{body}</p>
                  </div>
                </Reveal>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="feat" className="py-14 sm:py-20">
          <Reveal>
            <h2 id="feat" className="max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">Everything a small shop needs. Nothing it doesn’t.</h2>
          </Reveal>
          <Reveal delay={120} className="mt-10"><Features /></Reveal>
        </section>
      </main>

      {/* A slow band of greetings, because the app speaks the shop’s language. */}
      <section aria-labelledby="lang" className="border-y border-line bg-brand py-14 text-brand-ink">
        <div className="mx-auto max-w-6xl px-5">
          <Reveal>
            <h2 id="lang" className="max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">Speaks your language. Every screen. Every message.</h2>
            <p className="mt-3 max-w-xl opacity-85">Choose English, తెలుగు, हिन्दी, தமிழ் or ಕನ್ನಡ from the top bar, and the whole app changes. Your customers can get reminders in theirs.</p>
          </Reveal>
        </div>
        <div className="mt-10 overflow-hidden" aria-hidden>
          <div className="lp-marquee flex w-max gap-12 whitespace-nowrap text-4xl font-semibold sm:text-5xl">
            {[0, 1].map((k) => (
              <div key={k} className="flex gap-12">
                {["నమస్కారం", "नमस्ते", "வணக்கம்", "ನಮಸ್ಕಾರ", "Hello", "స్వాగతం", "स्वागत है", "வரவேற்கிறோம்", "ಸ್ವಾಗತ"].map((w) => <span key={`${k}-${w}`} className="opacity-90">{w}</span>)}
              </div>
            ))}
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-6xl px-5">
        <section aria-labelledby="who" className="py-14 sm:py-20">
          <Reveal><h2 id="who" className="text-3xl font-semibold tracking-tight sm:text-4xl">Made for shops like yours.</h2></Reveal>
          <ul className="mt-8 flex flex-wrap gap-2.5">
            {SHOPS.map((s, i) => (
              <li key={s}>
                <Reveal delay={i * 70}><span className="inline-block rounded-full border border-line bg-card px-4 py-2 text-sm font-medium shadow-[var(--shadow)]">{s}</span></Reveal>
              </li>
            ))}
          </ul>
        </section>

        <section id="faq" aria-labelledby="faq-h" className="scroll-mt-20 pb-14 sm:pb-20">
          <Reveal><h2 id="faq-h" className="text-3xl font-semibold tracking-tight sm:text-4xl">Questions shop owners ask</h2></Reveal>
          <div className="mt-8 max-w-3xl divide-y divide-line rounded-2xl border border-line bg-card">
            {FAQ.map(([q, a]) => (
              <details key={q} className="lp-faq group px-5 py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
                  {q}<Icon name="chevron" size={18} className="lp-chev shrink-0 text-muted transition" />
                </summary>
                <p className="mt-2 pr-8 text-muted">{a}</p>
              </details>
            ))}
          </div>
        </section>

        <section aria-labelledby="go" className="pb-16">
          <Reveal>
            <div className="rounded-3xl bg-ink px-6 py-12 text-center text-bg sm:px-12 sm:py-16">
              <h2 id="go" className="mx-auto max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">Start with one customer today.</h2>
              <p className="mx-auto mt-3 max-w-md opacity-80">Add your first customer, write what they owe, and send your first reminder before your tea gets cold.</p>
              <Link href="/login" className="lp-cta mt-8 inline-flex min-h-12 items-center gap-2 rounded-xl bg-brand px-7 text-base font-semibold text-brand-ink transition hover:-translate-y-0.5">
                Start free<Icon name="chevron" size={18} />
              </Link>
              <p className="mt-4 text-sm opacity-70">Only your mobile number. No card. Takes two minutes.</p>
            </div>
          </Reveal>
        </section>
      </main>

      <footer className="border-t border-line bg-card">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-8 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="flex items-center gap-2 font-semibold"><Logo size={26} />{BRAND.NAME}</span>
            <p className="mt-1 text-xs text-muted">© {new Date().getFullYear()} {LEGAL.COMPANY}. {BRAND.TAGLINE}</p>
          </div>
          <LegalLinks />
        </div>
      </footer>
    </div>
  );
}
