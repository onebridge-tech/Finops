import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { formatINR } from "@/lib/money";

export function Card({ className = "", ...p }: ComponentProps<"div">) {
  return <div className={`rounded-xl border border-line bg-card p-4 ${className}`} {...p} />;
}

export function PageHeader({ title, action, sub }: { title: string; sub?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold">{title}</h1>
        {sub && <div className="mt-0.5 text-sm text-muted">{sub}</div>}
      </div>
      {action}
    </div>
  );
}

const btn = {
  primary: "bg-brand text-brand-ink hover:opacity-90",
  secondary: "border border-line bg-card hover:bg-bg",
  danger: "border border-line text-gave hover:bg-bg",
};

export function buttonClass(variant: keyof typeof btn = "primary", extra = "") {
  return `inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition disabled:opacity-50 ${btn[variant]} ${extra}`;
}

export function LinkButton({ variant = "primary", className = "", ...p }: ComponentProps<typeof Link> & { variant?: keyof typeof btn }) {
  return <Link className={buttonClass(variant, className)} {...p} />;
}

export const inputClass =
  "w-full rounded-lg border border-line bg-card px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function Input({ className = "", ...p }: ComponentProps<"input">) {
  return <input className={`${inputClass} ${className}`} {...p} />;
}

export function Select({ className = "", ...p }: ComponentProps<"select">) {
  return <select className={`${inputClass} ${className}`} {...p} />;
}

export function ErrorText({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return <p role="alert" className="rounded-lg bg-gave/10 px-3 py-2 text-sm text-gave">{children}</p>;
}

/** Positive = they owe you (shown as "To collect"); negative = you owe them. */
export function Balance({ paise, className = "" }: { paise: number; className?: string }) {
  if (paise === 0) return <span className={`text-muted ${className}`}>Settled</span>;
  const collect = paise > 0;
  return (
    <span className={`${collect ? "text-gave" : "text-got"} font-semibold tabular-nums ${className}`}>
      {formatINR(Math.abs(paise))}
      <span className="ml-1 text-xs font-normal text-muted">{collect ? "to collect" : "to pay"}</span>
    </span>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <Card className="py-10 text-center">
      <p className="font-medium">{title}</p>
      {children && <div className="mt-2 text-sm text-muted">{children}</div>}
    </Card>
  );
}

export function fmtDate(d: Date | null | undefined) {
  return d ? d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }) : "—";
}

/** yyyy-mm-dd in IST, for <input type="date"> defaults. */
export function todayIST() {
  return new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
}
