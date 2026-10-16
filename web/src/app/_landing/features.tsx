"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Icon, type IconName } from "@/components/icon";
import { Avatar } from "@/components/ui";

type Tab = { id: string; icon: IconName; title: string; line: string; points: string[]; mock: ReactNode };

const Row = ({ name, note, amount, tone }: { name: string; note: string; amount: string; tone: "gave" | "got" }) => (
  <div className="flex items-center gap-3 border-b border-line px-3 py-2.5 last:border-0">
    <Avatar name={name} size={32} />
    <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{name}</p><p className="text-xs text-muted">{note}</p></div>
    <span className={`text-sm font-semibold tabular-nums ${tone === "gave" ? "text-gave" : "text-got"}`}>{amount}</span>
  </div>
);

const TABS: Tab[] = [
  {
    id: "book", icon: "note", title: "Credit book", line: "No more notebook. Write credit and payments in seconds.",
    points: ["Type a name and an amount. That is all.", "See every customer’s full account, day by day.", "Made a mistake? Undo it. Nothing is ever erased."],
    mock: (
      <div className="overflow-hidden rounded-2xl border border-line bg-card">
        <div className="flex items-center justify-between border-b border-line px-3 py-2.5 text-sm"><span className="font-semibold">Ravi Tea Traders</span><span className="font-semibold text-gave">₹4,100 to get</span></div>
        <Row name="Gave on credit" note="Tea powder 5 kg · Mon" amount="₹2,600" tone="gave" />
        <Row name="Gave on credit" note="Sugar 10 kg · Wed" amount="₹1,500" tone="gave" />
        <Row name="Got a payment" note="UPI · last week" amount="₹1,200" tone="got" />
      </div>
    ),
  },
  {
    id: "remind", icon: "send", title: "WhatsApp reminders", line: "Ask for the money politely, from your own WhatsApp.",
    points: ["The message is written for you, in your customer’s language.", "You tap Send. Nothing goes out without you.", "Free. No WhatsApp Business account needed."],
    mock: (
      <div className="space-y-3 rounded-2xl border border-line bg-card p-3">
        <p className="text-xs font-medium text-muted">Waiting in your outbox</p>
        {[["Ravi Tea Traders", "₹4,100"], ["Sri Kirana", "₹850"]].map(([n, a]) => (
          <div key={n} className="flex items-center gap-3 rounded-xl border border-line p-2.5">
            <Avatar name={n!} size={32} />
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{n}</p><p className="text-xs text-muted">Reminder · {a}</p></div>
            <span className="flex items-center gap-1 rounded-lg bg-[#0b6b58] px-2.5 py-1.5 text-xs font-semibold text-white"><Icon name="send" size={12} />Send</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    id: "bills", icon: "bill", title: "GST bills", line: "A proper bill with your shop name, ready in a minute.",
    points: ["Tax is worked out for you: CGST, SGST or IGST.", "Share on WhatsApp. Customers can pay by UPI from the link.", "Add your logo, bank details and terms once."],
    mock: (
      <div className="rounded-2xl border border-line bg-card p-4 text-sm">
        <div className="flex items-center justify-between"><span className="font-semibold">Tax invoice · INV-0142</span><span className="rounded-full bg-got/15 px-2 py-0.5 text-xs font-semibold text-got">Paid</span></div>
        <div className="mt-3 space-y-1.5 text-muted">
          <div className="flex justify-between"><span>Tea powder × 5 kg</span><span className="tabular-nums">₹2,500.00</span></div>
          <div className="flex justify-between"><span>CGST 2.5%</span><span className="tabular-nums">₹62.50</span></div>
          <div className="flex justify-between"><span>SGST 2.5%</span><span className="tabular-nums">₹62.50</span></div>
        </div>
        <div className="mt-3 flex justify-between border-t border-line pt-3 text-base font-semibold"><span>Total</span><span className="tabular-nums">₹2,625.00</span></div>
      </div>
    ),
  },
  {
    id: "money", icon: "trend", title: "Money in & out", line: "Upload your bank statement. See what you earned and spent.",
    points: ["Every line sorted into rent, salaries, stock and more.", "Fix a group once. It remembers.", "Profit and loss, month by month."],
    mock: (
      <div className="rounded-2xl border border-line bg-card p-4">
        <div className="grid grid-cols-3 gap-2 text-center text-xs text-muted">
          <div><p>Came in</p><p className="text-base font-semibold text-got">₹68,400</p></div>
          <div><p>Went out</p><p className="text-base font-semibold text-gave">₹52,150</p></div>
          <div><p>Left over</p><p className="text-base font-semibold text-ink">₹16,250</p></div>
        </div>
        <div className="mt-4 flex h-28 items-end gap-2" aria-hidden>
          {[40, 62, 48, 80, 58, 90].map((h, i) => (
            <div key={i} className="flex flex-1 flex-col justify-end gap-1">
              <div className="lp-bar rounded-t bg-brand" style={{ height: `${h}%`, animationDelay: `${i * 80}ms` }} />
            </div>
          ))}
        </div>
      </div>
    ),
  },
];

/** Four things the app does, one at a time, changing by itself until the visitor takes over. */
export function Features() {
  const [i, setI] = useState(0);
  const [auto, setAuto] = useState(true);
  useEffect(() => {
    if (!auto || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setI((x) => (x + 1) % TABS.length), 5500);
    return () => clearInterval(id);
  }, [auto]);
  const tab = TABS[i]!;

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[1fr_1.05fr]">
      <div role="tablist" aria-label="What FinOps does" className="space-y-2">
        {TABS.map((t, n) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={n === i}
            onClick={() => { setAuto(false); setI(n); }}
            className={`relative w-full overflow-hidden rounded-xl border p-4 text-left transition ${n === i ? "border-brand bg-card shadow-[var(--shadow)]" : "border-transparent hover:bg-card/60"}`}
          >
            <span className="flex items-center gap-3">
              <span className={`flex size-9 items-center justify-center rounded-lg transition ${n === i ? "bg-brand text-brand-ink" : "bg-brand-soft text-brand"}`}><Icon name={t.icon} size={18} /></span>
              <span><span className="block font-semibold">{t.title}</span><span className="block text-sm text-muted">{t.line}</span></span>
            </span>
            {n === i && auto && <span key={`${i}-bar`} className="lp-progress absolute bottom-0 left-0 h-0.5 bg-brand" />}
          </button>
        ))}
      </div>
      <div key={tab.id} role="tabpanel" className="lp-swap space-y-4">
        {tab.mock}
        <ul className="space-y-2 text-sm text-muted">
          {tab.points.map((p) => <li key={p} className="flex gap-2"><Icon name="check" size={16} className="mt-0.5 shrink-0 text-got" />{p}</li>)}
        </ul>
      </div>
    </div>
  );
}
