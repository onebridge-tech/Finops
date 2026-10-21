import type { MetadataRoute } from "next";
import { BRAND } from "@/lib/brand";
import { MARK_VERSION } from "@/lib/brand-mark";

export default function manifest(): MetadataRoute.Manifest {
  // The icons are cached for a year, so their addresses carry the mark's version: a new logo reaches installed apps.
  const icon = (name: string) => `/icons/${name}?v=${MARK_VERSION}`;
  return {
    name: `${BRAND.NAME} — ${BRAND.TAGLINE}`,
    short_name: BRAND.NAME,
    description: BRAND.ABOUT,
    id: "/",
    start_url: "/dashboard",
    scope: "/",
    lang: "en-IN",
    dir: "ltr",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f7f6f4",
    theme_color: "#ff8000",
    categories: ["business", "finance", "productivity"],
    prefer_related_applications: false,
    icons: [
      { src: icon("192.png"), sizes: "192x192", type: "image/png", purpose: "any" },
      { src: icon("512.png"), sizes: "512x512", type: "image/png", purpose: "any" },
      { src: icon("maskable-192.png"), sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: icon("maskable-512.png"), sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    // Long-press the app icon on the phone to jump straight to these.
    shortcuts: [
      { name: "Make a bill", url: "/invoices/new", icons: [{ src: icon("192.png"), sizes: "192x192", type: "image/png" }] },
      { name: "Customers", url: "/parties", icons: [{ src: icon("192.png"), sizes: "192x192", type: "image/png" }] },
      { name: "Collect money", url: "/collections", icons: [{ src: icon("192.png"), sizes: "192x192", type: "image/png" }] },
      { name: "Cash sale", url: "/cash-sales", icons: [{ src: icon("192.png"), sizes: "192x192", type: "image/png" }] },
    ],
  };
}
