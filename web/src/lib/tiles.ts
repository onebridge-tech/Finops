// Dashboard tiles (IR-01): which ones each member sees, and in what order. Pure.

export const TILES = {
  toCollect: { label: "To collect", kind: "stat" },
  overdue: { label: "Overdue", kind: "stat" },
  toPay: { label: "To pay", kind: "stat" },
  collectedToday: { label: "Collected today", kind: "stat" },
  cashToday: { label: "Cash in today", kind: "stat" },
  creditToday: { label: "Credit given today", kind: "stat" },
  followUpsDue: { label: "Follow-ups due", kind: "stat" },
  openQuotes: { label: "Open quotations", kind: "stat" },
  gstMonth: { label: "GST on this month’s invoices", kind: "stat" },
  topOverdue: { label: "Top overdue", kind: "list" },
  recent: { label: "Recent activity", kind: "list" },
  team: { label: "Team activity today", kind: "list" },
} as const;

export type TileId = keyof typeof TILES;

export const DEFAULT_TILES: TileId[] = ["toCollect", "overdue", "toPay", "collectedToday", "followUpsDue", "topOverdue", "recent", "team"];

/** The saved layout, ignoring unknown ids; the default when nothing is saved. */
export function parseTiles(saved: string | null | undefined): TileId[] {
  if (!saved) return DEFAULT_TILES;
  try {
    const ids = JSON.parse(saved);
    if (!Array.isArray(ids)) return DEFAULT_TILES;
    return [...new Set(ids.filter((id): id is TileId => typeof id === "string" && id in TILES))];
  } catch {
    return DEFAULT_TILES;
  }
}
