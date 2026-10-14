"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export type Command = { href: string; label: string; hint?: string };

const QUICK: Command[] = [
  { href: "/parties/new", label: "Add a customer", hint: "or a supplier" },
  { href: "/invoices/new", label: "Make a bill" },
  { href: "/quotes/new", label: "New price quote" },
  { href: "/orders/new", label: "New order" },
  { href: "/expenses", label: "Write a shop expense" },
  { href: "/search", label: "Search everything" },
];

/** Ctrl+K (or Alt+G) opens a type-to-jump list of every screen and common action (LO-04). */
export function CommandPalette({ screens }: { screens: Command[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [i, setI] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const all = useMemo(() => [...QUICK, ...screens], [screens]);
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (t ? all.filter((c) => `${c.label} ${c.hint ?? ""}`.toLowerCase().includes(t)) : all).slice(0, 12);
  }, [all, q]);

  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen((o) => !o); }
      else if (e.altKey && e.key.toLowerCase() === "g") { e.preventDefault(); setOpen(true); }
      else if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, []);
  useEffect(() => { if (open) input.current?.focus(); }, [open]);

  const go = (c: Command | undefined) => { if (!c) return; setOpen(false); setQ(""); setI(0); router.push(c.href); };
  if (!open) return null;
  return (
    <div className="no-print fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[15vh]" onClick={() => setOpen(false)}>
      <div role="dialog" aria-modal="true" aria-label="Go to" className="w-full max-w-md overflow-hidden rounded-xl border border-line bg-card shadow-xl" onClick={(e) => e.stopPropagation()}>
        <input
          ref={input} value={q} placeholder="Go to… (type a screen or action)" aria-label="Go to"
          onChange={(e) => { setQ(e.target.value); setI(0); }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setI((x) => Math.min(x + 1, shown.length - 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setI((x) => Math.max(x - 1, 0)); }
            else if (e.key === "Enter") { e.preventDefault(); go(shown[i]); }
          }}
          className="w-full border-b border-line bg-transparent px-4 py-3 text-sm outline-none"
        />
        <ul role="listbox" className="max-h-80 overflow-auto py-1 text-sm">
          {shown.map((c, n) => (
            <li key={c.href + c.label} role="option" aria-selected={n === i}>
              <button type="button" onMouseEnter={() => setI(n)} onClick={() => go(c)} className={`flex w-full justify-between px-4 py-2 text-left ${n === i ? "bg-bg" : ""}`}>
                <span>{c.label}</span><span className="text-xs text-muted">{c.hint}</span>
              </button>
            </li>
          ))}
          {shown.length === 0 && <li className="px-4 py-3 text-muted">Nothing matches.</li>}
        </ul>
        <p className="border-t border-line px-4 py-2 text-xs text-muted">↑↓ to choose · Enter to open · Esc to close</p>
      </div>
    </div>
  );
}
