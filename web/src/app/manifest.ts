import type { MetadataRoute } from "next";
import { BRAND } from "@/lib/brand";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${BRAND.NAME} — ${BRAND.TAGLINE}`,
    short_name: BRAND.NAME,
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#f5f6fa",
    theme_color: "#4f46e5",
    icons: [{ src: "/favicon.ico", sizes: "any", type: "image/x-icon" }],
  };
}
