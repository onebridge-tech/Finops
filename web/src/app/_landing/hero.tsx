"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Icon } from "@/components/icon";
import { Avatar } from "@/components/ui";
import { guessLang, HERO, LANG_LABEL, type LandingLang } from "./copy";
import { Money } from "./motion";

const noop = () => () => {};
/** Language tags the visitor’s browser prefers; the server renders English and the browser switches after loading. */
const useBrowserLang = (): LandingLang => useSyncExternalStore(noop, () => guessLang(navigator.languages?.length ? navigator.languages : [navigator.language]), () => "en");
const useReducedMotion = () => useSyncExternalStore(noop, () => window.matchMedia("(prefers-reduced-motion: reduce)").matches, () => false);

const LANGS = Object.keys(LANG_LABEL) as LandingLang[];
const ROWS = [
  { name: "Lakshmi General Stores", amount: 12400 },
  { name: "Ravi Tea Traders", amount: 4100 },
  { name: "Sri Kirana", amount: 850 },
];

export function Hero() {
  const detected = useBrowserLang();
  const [picked, setPicked] = useState<LandingLang | null>(null);
  const lang = picked ?? detected;
  const t = HERO[lang];

  return (
    <section className="grid items-center gap-12 py-10 sm:py-16 lg:grid-cols-[1.05fr_0.95fr]">
      <div>
        <div role="group" aria-label="Choose language" className="mb-6 flex flex-wrap gap-1.5">
          {LANGS.map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setPicked(l)}
              aria-pressed={lang === l}
              className={`rounded-full border px-3 py-1 text-sm font-medium transition ${lang === l ? "border-brand bg-brand text-brand-ink" : "border-line bg-card text-muted hover:border-brand/50 hover:text-ink"}`}
            >
              {LANG_LABEL[l]}
            </button>
          ))}
        </div>
        <h1 key={lang} lang={lang} className="lp-swap text-4xl font-semibold leading-[1.15] tracking-tight sm:text-5xl">{t.title}</h1>
        <p key={`${lang}-s`} lang={lang} className="lp-swap mt-5 max-w-lg text-base leading-relaxed text-muted sm:text-lg">{t.sub}</p>
        <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3">
          <Link href="/login" className="lp-cta inline-flex min-h-12 items-center gap-2 rounded-xl bg-brand px-6 text-base font-semibold text-brand-ink shadow-[var(--shadow-lg)] transition hover:-translate-y-0.5">
            <span lang={lang}>{t.cta}</span><Icon name="chevron" size={18} />
          </Link>
          <span className="text-sm text-muted">Only your mobile number. Takes two minutes.</span>
        </div>
        <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
          {["Free to start", "Works on any phone", "Works without signal", "Your data is yours"].map((x) => (
            <li key={x} className="flex items-center gap-1.5"><Icon name="check" size={15} className="text-got" />{x}</li>
          ))}
        </ul>
      </div>
      <Phone lang={lang} />
    </section>
  );
}

/** A phone that plays the whole story on a loop: money owed, one tap, the reminder, the money coming in. */
function Phone({ lang }: { lang: LandingLang }) {
  const reduce = useReducedMotion();
  const [stepRaw, setStep] = useState(0);
  const [charsRaw, setChars] = useState(0);
  const msg = HERO[lang].msg;
  const step = reduce ? 4 : stepRaw;
  const chars = reduce ? msg.length : charsRaw;

  useEffect(() => {
    if (reduce || stepRaw === 2) return; // while the message is typed, the typing effect moves on by itself
    const wait = [2200, 900, 0, 1500, 4200][stepRaw] ?? 2000;
    const id = setTimeout(() => {
      if (stepRaw === 1) setChars(0);
      setStep((s) => (s + 1) % 5);
    }, wait);
    return () => clearTimeout(id);
  }, [stepRaw, reduce]);

  useEffect(() => {
    if (reduce || stepRaw !== 2) return;
    const id = setInterval(() => {
      setChars((c) => {
        if (c + 2 >= msg.length) { clearInterval(id); setTimeout(() => setStep(3), 500); return msg.length; }
        return c + 2;
      });
    }, 35);
    return () => clearInterval(id);
  }, [stepRaw, msg, reduce]);
  const paid = step >= 4;
  const rows = ROWS.map((r) => (r.name === "Ravi Tea Traders" && paid ? { ...r, amount: 0 } : r));
  const total = rows.reduce((s, r) => s + r.amount, 0);

  return (
    <div className="relative mx-auto w-full max-w-[320px]" aria-hidden>
      <div className="lp-float absolute -left-16 top-28 z-10 hidden items-center gap-2 rounded-xl border border-line bg-card px-3 py-2 text-sm font-medium shadow-[var(--shadow-lg)] sm:flex">
        <span className="flex size-7 items-center justify-center rounded-full bg-got/15 text-got"><Icon name="arrowDown" size={14} /></span>UPI received
      </div>
      <div className="lp-float-slow absolute -right-14 bottom-28 z-10 hidden items-center gap-2 rounded-xl border border-line bg-card px-3 py-2 text-sm font-medium shadow-[var(--shadow-lg)] sm:flex">
        <span className="flex size-7 items-center justify-center rounded-full bg-brand-soft text-brand"><Icon name="bill" size={14} /></span>GST bill ready
      </div>

      <div className="relative overflow-hidden rounded-[2.2rem] border-[10px] border-ink/90 bg-bg shadow-[var(--shadow-lg)]">
        <div className="mx-auto mt-1 h-1.5 w-16 rounded-full bg-line" />
        <div className="px-4 pb-4 pt-3">
          <div className="flex items-center justify-between text-xs text-muted"><span>Sri Tea Stall</span><span>Today</span></div>
          <div className="mt-3 rounded-2xl border border-line bg-card p-4">
            <p className="text-xs text-muted">Money to get</p>
            <Money to={total} className="text-3xl font-semibold text-gave" />
          </div>
          <div className="mt-3 divide-y divide-line rounded-2xl border border-line bg-card">
            {rows.map((r) => {
              const isRavi = r.name === "Ravi Tea Traders";
              return (
                <div key={r.name} className={`flex items-center gap-3 px-3 py-2.5 transition-colors duration-500 ${isRavi && step >= 1 && step < 4 ? "bg-brand-soft" : ""}`}>
                  <Avatar name={r.name} size={34} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{r.name}</p>
                    <p className="text-xs text-muted">{isRavi && paid ? "Paid just now" : isRavi ? "12 days late" : "Due this week"}</p>
                  </div>
                  {isRavi && paid ? (
                    <span className="lp-pop flex items-center gap-1 rounded-full bg-got/15 px-2.5 py-1 text-xs font-semibold text-got"><Icon name="check" size={13} />Paid</span>
                  ) : (
                    <span className="text-sm font-semibold tabular-nums text-gave">₹{r.amount.toLocaleString("en-IN")}</span>
                  )}
                </div>
              );
            })}
          </div>
          <div className="relative mt-3">
            <button type="button" tabIndex={-1} className={`flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3 text-sm font-semibold text-brand-ink transition ${step === 1 ? "scale-95" : ""}`}>
              <Icon name="send" size={16} />Ask for money
            </button>
            {step === 1 && <span className="lp-ripple absolute left-1/2 top-1/2 size-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand/30" />}
          </div>
        </div>

        {/* The WhatsApp message slides up over the phone while it is being written. */}
        <div className={`absolute inset-x-0 bottom-0 top-14 flex flex-col bg-[#e7ded2] transition-transform duration-500 dark:bg-[#0f1a17] ${step >= 2 && step < 4 ? "translate-y-0" : "translate-y-full"}`}>
          <div className="flex items-center gap-2 bg-[#0b6b58] px-4 py-3 text-sm font-medium text-white"><Avatar name="Ravi Tea Traders" size={26} />Ravi Tea Traders</div>
          <div className="flex flex-1 items-end p-3">
            <div lang={lang} className="relative ml-auto max-w-[88%] rounded-2xl rounded-br-sm bg-[#d9fdd3] px-3 py-2 text-[13px] leading-snug text-[#111b21] shadow-sm dark:bg-[#005c4b] dark:text-[#e9edef]">
              {msg.slice(0, chars)}<span className={chars < msg.length ? "lp-caret" : "hidden"} />
              <span className="mt-1 flex items-center justify-end gap-1 text-[10px] opacity-60">now{step >= 3 && <Icon name="check" size={11} className="lp-pop text-[#53bdeb]" />}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
