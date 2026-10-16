import type { ComponentProps } from "react";
import { MarkSvg } from "@/lib/brand-mark";

// One small icon set (24px, drawn with a 2px line) so every screen speaks the same visual language.
const PATHS = {
  home: "M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
  users: "M9 11.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20c0-3.3 2.9-6 6.5-6s6.5 2.7 6.5 6M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.3c2.2.7 3.5 2.7 3.5 5.7",
  bill: "M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6",
  rupee: "M7 5h10M7 9h10M7 5c5 0 7 1.5 7 4s-2 4-7 4l8 6",
  phone: "M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z",
  grid: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z",
  plus: "M12 5v14M5 12h14",
  box: "M21 8 12 3 3 8v8l9 5 9-5zM3 8l9 5 9-5M12 13v8",
  cart: "M3 4h2l2.5 11h10l2-8H6.5M9 20h.01M17 20h.01",
  chart: "M4 20h16M7 20v-8M12 20V5M17 20v-5",
  wallet: "M3 7h17a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1zM3 7l12-3v3M17 14h.01",
  sliders: "M4 7h10M18 7h2M4 17h2M10 17h10M16 7m-2 0a2 2 0 1 0 4 0 2 2 0 1 0-4 0M8 17m-2 0a2 2 0 1 0 4 0 2 2 0 1 0-4 0",
  walk: "M13 4.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM9 21l2-7-2.5-2 1.5-5 3 1 2 3 3 1M11 14l4 2 1 5",
  search: "M11 17a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM20 20l-4-4",
  tag: "M3 12V4h8l10 10-8 8zM7.5 8.5h.01",
  note: "M6 3h9l4 4v14H6zM14 3v5h5M9 13h6M9 17h6",
  link: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
  card: "M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM2 10h20",
  download: "M12 4v11M7 11l5 5 5-5M5 20h14",
  bell: "M6 16v-5a6 6 0 0 1 12 0v5l2 2H4zM10 21h4",
  undo: "M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3",
  handshake: "M2 12l5-5 4 2 3-2 6 5M2 12l6 6 2-1 2 2 3-1 2 2 3-3",
  send: "M21 3 3 10l7 3 3 7zM10 13l11-10",
  check: "M5 12.5 10 17.5 19 7",
  arrowDown: "M12 5v14M6 13l6 6 6-6",
  arrowUp: "M12 19V5M6 11l6-6 6 6",
  chevron: "M9 6l6 6-6 6",
  bank: "M3 10 12 4l9 6M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18",
  lock: "M7 11V8a5 5 0 0 1 10 0v3M6 11h12v9H6zM12 15v2",
  logout: "M15 17l5-5-5-5M20 12H9M12 20H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7",
  trend: "M3 17l6-6 4 4 8-8M15 7h6v6",
  calendar: "M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM4 10h16M8 3v4M16 3v4",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2",
  globe: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-5.5-3.5-9S9.5 5.5 12 3z",
  help: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M12 17h.01",
  warning: "M12 4 2.5 20h19zM12 10v4M12 17h.01",
  shop: "M4 9l1.5-5h13L20 9M4 9v11h16V9M4 9c0 1.7 1.3 3 3 3s3-1.3 3-3c0 1.7 1.3 3 3 3s3-1.3 3-3c0 1.7 1.3 3 3 3M10 20v-5h4v5",
} as const;

export type IconName = keyof typeof PATHS;
export const isIconName = (n: string): n is IconName => n in PATHS;

export function Icon({ name, size = 22, ...p }: { name: IconName; size?: number } & Omit<ComponentProps<"svg">, "name">) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...p}>
      <path d={PATHS[name]} />
    </svg>
  );
}

/** The app mark: the same rupee tile used for the browser icon and home-screen icons (see lib/brand-mark.tsx). */
export function Logo({ size = 28 }: { size?: number }) {
  return <MarkSvg size={size} rounded={0.22} style={{ display: "block", flexShrink: 0 }} />;
}
