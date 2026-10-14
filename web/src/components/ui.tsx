import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { formatINR } from "@/lib/money";
import { translator, type T } from "@/lib/i18n";

export function Card({ className = "", ...p }: ComponentProps<"div">) {
  return <div className={`rounded-2xl border border-line bg-card p-4 sm:p-5 ${className}`} {...p} />;
}

export function PageHeader({ title, action, sub }: { title: string; sub?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {sub && <div className="mt-1 text-base text-muted">{sub}</div>}
      </div>
      {action}
    </div>
  );
}

const btn = {
  primary: "bg-brand text-brand-ink hover:opacity-90 active:opacity-80",
  secondary: "border border-line bg-card hover:bg-bg",
  danger: "border border-line text-gave hover:bg-bg",
};

export function buttonClass(variant: keyof typeof btn = "primary", extra = "") {
  return `inline-flex items-center justify-center gap-2 min-h-11 rounded-xl px-4 py-2.5 text-base font-semibold transition disabled:opacity-50 ${btn[variant]} ${extra}`;
}

export function LinkButton({ variant = "primary", className = "", ...p }: ComponentProps<typeof Link> & { variant?: keyof typeof btn }) {
  return <Link className={buttonClass(variant, className)} {...p} />;
}

export const inputClass =
  "min-h-12 w-full rounded-xl border border-line bg-card px-3.5 py-2.5 text-base outline-none placeholder:text-muted/70 focus:border-brand focus:ring-2 focus:ring-brand/25";

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-base font-semibold">{label}</span>
      {children}
      {hint && <span className="block text-sm text-muted">{hint}</span>}
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
  return <p role="alert" className="rounded-xl bg-gave/10 px-3.5 py-2.5 text-base text-gave">{children}</p>;
}

/**
 * Positive = they owe you ("to collect"); negative = you owe them. In the
 * accountant view the same balance reads as Dr / Cr.
 */
export function Balance({ paise, className = "", t, accountant = false }: { paise: number; className?: string; t?: T; accountant?: boolean }) {
  const tr = t ?? translator("en");
  if (paise === 0) return <span className={`text-muted ${className}`}>{tr("bal.settled")}</span>;
  const collect = paise > 0;
  return (
    <span className={`${collect ? "text-gave" : "text-got"} font-semibold tabular-nums ${className}`}>
      {formatINR(Math.abs(paise))}
      <span className="ml-1.5 text-sm font-normal text-muted">{accountant ? (collect ? "Dr" : "Cr") : tr(collect ? "bal.toCollect" : "bal.toPay")}</span>
    </span>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <Card className="py-10 text-center">
      <p className="text-lg font-semibold">{title}</p>
      {children && <div className="mt-2 text-base text-muted">{children}</div>}
    </Card>
  );
}

export { fmtDate, todayIST } from "@/lib/format";
