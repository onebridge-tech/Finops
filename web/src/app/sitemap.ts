import type { MetadataRoute } from "next";
import { LEGAL, LEGAL_PAGES } from "@/lib/legal";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: LEGAL.SITE, lastModified: now, priority: 1 },
    { url: `${LEGAL.SITE}/login`, lastModified: now, priority: 0.6 },
    ...LEGAL_PAGES.map((p) => ({ url: `${LEGAL.SITE}${p.href}`, lastModified: now, priority: 0.3 })),
  ];
}
