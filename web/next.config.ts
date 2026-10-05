import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Enables forbidden() for pages a role may not open.
    authInterrupts: true,
    // Entry attachments are up to 5 MB (LG-03); leave room for multipart overhead.
    serverActions: { bodySizeLimit: "6mb" },
  },
};

export default nextConfig;
