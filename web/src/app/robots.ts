import type { MetadataRoute } from "next";
import { LEGAL } from "@/lib/legal";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: ["/", "/login", "/terms", "/privacy", "/refund-policy", "/acceptable-use", "/cookies", "/grievance"], disallow: ["/api/", "/platform", "/dashboard", "/settings", "/pay/"] }],
    sitemap: `${LEGAL.SITE}/sitemap.xml`,
  };
}
