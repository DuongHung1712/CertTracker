import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Evidence uploads go through a Server Action; the default cap is 1 MB. Files are limited to
    // 4 MB in src/lib/storage/evidence.ts — 5 MB here leaves room for multipart overhead.
    serverActions: { bodySizeLimit: "5mb" },
  },
};

export default nextConfig;
