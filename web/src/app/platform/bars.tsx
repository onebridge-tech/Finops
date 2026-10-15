// Small bar charts for the admin area. Plain HTML, so they print and need no chart library.

export type Series = { day: string; n: number }[];

export function Bars({ series, label, tone = "brand" }: { series: Series; label: string; tone?: "brand" | "got" | "warn" }) {
  const max = Math.max(1, ...series.map((s) => s.n));
  const color = { brand: "bg-brand", got: "bg-got", warn: "bg-warn" }[tone];
  const total = series.reduce((s, x) => s + x.n, 0);
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <p className="text-[13px] font-medium text-muted">{label}</p>
        <p className="text-sm font-semibold tabular-nums">{total}</p>
      </div>
      <div className="flex h-24 items-end gap-1" role="img" aria-label={`${label}, last ${series.length} days, ${total} in total`}>
        {series.map((s) => (
          <div key={s.day} className="group relative flex h-full flex-1 items-end" title={`${s.day}: ${s.n}`}>
            <div className={`w-full rounded-t ${color} ${s.n ? "" : "opacity-20"}`} style={{ height: `${s.n ? Math.max(6, (s.n / max) * 100) : 3}%` }} />
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-muted"><span>{series[0]?.day.slice(5)}</span><span>{series[series.length - 1]?.day.slice(5)}</span></div>
    </div>
  );
}

export function since(d: Date | null): string {
  if (!d) return "Never";
  const m = Math.round((Date.now() - d.getTime()) / 60_000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const days = Math.round(h / 24);
  return days < 30 ? `${days} d ago` : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
}
