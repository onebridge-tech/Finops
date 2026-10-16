import type { CSSProperties } from "react";

// The FinOps mark: a rupee sign on an indigo tile. One drawing is used for the in-app logo, the browser icon,
// the home-screen icons and the share image, so they always match.
export const MARK = { bg: "#4f46e5", fg: "#ffffff", path: "M7 5h10M7 9h10M7 5c5 0 7 1.5 7 4s-2 4-7 4l8 6" } as const;

/**
 * The mark as an SVG element. `rounded` is the corner radius as a share of the tile (0 = square, for icons
 * that the phone rounds itself), and `inset` shrinks the rupee so a phone can crop the edges (maskable icons).
 */
export function MarkSvg({ size, rounded = 0.22, inset = 0, style }: { size: number; rounded?: number; inset?: number; style?: CSSProperties }) {
  const scale = 2 * (1 - inset * 2);
  const t = 32 - 12 * scale;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" style={style} xmlns="http://www.w3.org/2000/svg">
      <rect width="64" height="64" rx={64 * rounded} fill={MARK.bg} />
      <g transform={`translate(${t} ${t}) scale(${scale})`} fill="none" stroke={MARK.fg} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d={MARK.path} />
      </g>
    </svg>
  );
}
