import type { NextConfig } from "next";

// Sent with every page: no framing by other sites (clickjacking), no MIME sniffing, a short referrer,
// browser features limited to what the app uses (camera for photos, microphone for voice notes, location
// for field visits), and HTTPS only once the browser has seen the site over HTTPS.
const securityHeaders = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=(self), payment=(self), usb=(), browsing-topics=()" },
  ...(process.env.NODE_ENV === "production" ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }] : []),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    // Enables forbidden() for pages a role may not open.
    authInterrupts: true,
    // Entry attachments are up to 5 MB (LG-03); leave room for multipart overhead.
    serverActions: { bodySizeLimit: "6mb" },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
