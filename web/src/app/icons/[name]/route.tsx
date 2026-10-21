import { ImageResponse } from "next/og";
import { MarkSvg } from "@/lib/brand-mark";

// Home-screen icons named in manifest.ts: /icons/192.png, /icons/512.png and /icons/maskable-512.png.
// "Maskable" icons are drawn to the edge with the rupee kept in the middle, so any phone shape can crop them.
const ICONS: Record<string, { px: number; rounded: number; inset: number }> = {
  "192.png": { px: 192, rounded: 0.22, inset: 0 },
  "512.png": { px: 512, rounded: 0.22, inset: 0 },
  "maskable-192.png": { px: 192, rounded: 0, inset: 0.1 },
  "maskable-512.png": { px: 512, rounded: 0, inset: 0.1 },
};

export function generateStaticParams() {
  return Object.keys(ICONS).map((name) => ({ name }));
}

export async function GET(_req: Request, ctx: { params: Promise<{ name: string }> }) {
  const { name } = await ctx.params;
  const icon = ICONS[name];
  if (!icon) return new Response("Not found", { status: 404 });
  return new ImageResponse(<MarkSvg size={icon.px} rounded={icon.rounded} inset={icon.inset} />, { width: icon.px, height: icon.px, headers: { "Cache-Control": "public, max-age=31536000, immutable" } });
}
