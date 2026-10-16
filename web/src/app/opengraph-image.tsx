import { ImageResponse } from "next/og";
import { MarkSvg } from "@/lib/brand-mark";
import { BRAND } from "@/lib/brand";

// The picture shown when the site is shared on WhatsApp, Facebook, LinkedIn and similar. Latin text only,
// because the image generator's built-in font has no Indian scripts.
export const alt = `${BRAND.NAME} — ${BRAND.TAGLINE}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraph() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#0b1020", color: "#e8ecf6", padding: 72 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <MarkSvg size={72} />
          <span style={{ fontSize: 44, fontWeight: 700 }}>{BRAND.NAME}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <span style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.1, maxWidth: 980 }}>{BRAND.TAGLINE}</span>
          <span style={{ fontSize: 32, color: "#97a3ba", maxWidth: 900 }}>Credit book, WhatsApp reminders and GST bills for small shops.</span>
        </div>
        <div style={{ display: "flex", gap: 14, fontSize: 26, color: "#8b93ff" }}>
          <span>Free to start</span><span>·</span><span>Works on any phone</span><span>·</span><span>English, Telugu, Hindi, Tamil, Kannada</span>
        </div>
      </div>
    ),
    size,
  );
}
