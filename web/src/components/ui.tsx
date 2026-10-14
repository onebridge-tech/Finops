import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { formatINR } from "@/lib/money";
import { translator, type T } from "@/lib/i18n";
import { Icon, type IconName } from "./icon";

// Shared building blocks. Every screen is made from these, so the look stays the same everywhere.

export function Card({ className = "", ...p }: ComponentProps<"div">) {
  return <div className={`rounded-xl border border-line bg-card p-4 shadow-[var(--shadow)] sm:p-5 ${className}`} {...p} />;
}

export function PageHeader({ title, action, sub, leading }: { title: string; sub?: ReactNode; action?: ReactNode; leading?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
      <div className="flex min-w-0 items-center gap-3">
        {leading}
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold tracking-tight">{title}</h1>
          {sub && <div className="mt-0.5 text-sm text-muted">{sub}</div>}
        </div>
      </div>
      {action}
    </div>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 mt-8 flex items-center justify-between gap-3 first:mt-0">
      <h2 className="text-base font-semibold tracking-tight">{children}</h2>
      {action}
    </div>
  );
}

const btn = {
  primary: "bg-brand text-brand-ink shadow-sm hover:brightness-110 active:brightness-95",
  secondary: "border border-line bg-card text-ink shadow-sm hover:bg-bg",
  danger: "border border-line bg-card text-gave shadow-sm hover:bg-gave/5",
};

export function buttonClass(variant: keyof typeof btn = "primary", extra = "") {
  return `inline-flex min-h-10 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-medium transition disabled:pointer-events-none disabled:opacity-50 sm:min-h-9 sm:py-1.5 ${btn[variant]} ${extra}`;
}

export function LinkButton({ variant = "primary", className = "", ...p }: ComponentProps<typeof Link> & { variant?: keyof typeof btn }) {
  return <Link className={buttonClass(variant, className)} {...p} />;
}

export const inputClass =
  "block min-h-10 w-full rounded-lg border border-line bg-card px-3 py-2 text-sm text-ink shadow-sm outline-none transition placeholder:text-muted/60 focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:opacity-60";

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-[13px] font-medium">{label}</span>
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
  return <p role="alert" className="rounded-lg border border-gave/20 bg-gave/10 px-3 py-2 text-sm text-gave">{children}</p>;
}

type Tone = "neutral" | "good" | "bad" | "warn" | "brand";
const TONE: Record<Tone, string> = {
  neutral: "bg-bg text-muted ring-line",
  good: "bg-got/10 text-got ring-got/20",
  bad: "bg-gave/10 text-gave ring-gave/20",
  warn: "bg-warn/10 text-warn ring-warn/20",
  brand: "bg-brand-soft text-brand ring-brand/20",
};

/** A small status pill: Paid, Late, Open... */
export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${TONE[tone]}`}>{children}</span>;
}

const AVATAR = [
  "bg-indigo-100 text-indigo-700", "bg-emerald-100 text-emerald-700", "bg-amber-100 text-amber-800", "bg-rose-100 text-rose-700",
  "bg-sky-100 text-sky-700", "bg-violet-100 text-violet-700", "bg-teal-100 text-teal-700", "bg-orange-100 text-orange-700",
];

/** Initials in a soft colour that always comes out the same for the same name. */
export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const clean = name.trim() || "?";
  const parts = clean.split(/\s+/);
  const initials = ((parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "")).toUpperCase();
  let h = 0;
  for (const c of clean) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return (
    <span className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold ${AVATAR[h % AVATAR.length]}`} style={{ width: size, height: size, fontSize: size * 0.38 }} aria-hidden>
      {initials}
    </span>
  );
}

/** A number card: label, big figure, small note, optional link. */
export function StatCard({ label, value, hint, tone, icon, href }: { label: string; value: string; hint?: string; tone?: "gave" | "got"; icon?: IconName; href?: string }) {
  const body = (
    <Card className={`h-full ${href ? "transition hover:border-brand/40 hover:shadow-md" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] font-medium text-muted">{label}</p>
        {icon && (
          <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${tone === "gave" ? "bg-gave/10 text-gave" : tone === "got" ? "bg-got/10 text-got" : "bg-brand-soft text-brand"}`}>
            <Icon name={icon} size={17} />
          </span>
        )}
      </div>
      <p className={`mt-2 text-2xl font-semibold tabular-nums tracking-tight ${tone === "gave" ? "text-gave" : tone === "got" ? "text-got" : ""}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </Card>
  );
  return href ? <Link href={href} className="block h-full">{body}</Link> : body;
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
      <span className="ml-1.5 text-xs font-normal text-muted">{accountant ? (collect ? "Dr" : "Cr") : tr(collect ? "bal.toCollect" : "bal.toPay")}</span>
    </span>
  );
}

export function EmptyState({ title, children, icon = "note", action }: { title: string; children?: ReactNode; icon?: IconName; action?: ReactNode }) {
  return (
    <Card className="flex flex-col items-center px-6 py-12 text-center">
      <span className="mb-3 flex size-12 items-center justify-center rounded-full bg-brand-soft text-brand"><Icon name={icon} size={22} /></span>
      <p className="text-base font-semibold">{title}</p>
      {children && <div className="mt-1 max-w-sm text-sm text-muted">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </Card>
  );
}

export { fmtDate, todayIST } from "@/lib/format";
