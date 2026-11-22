import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The menu calls it "My learning"; people type that, the route is /me.
  redirects: async () => [{ source: "/my-learning", destination: "/me", permanent: false }],
  // The PDF renderer of the AI certificate reader (src/lib/ai/pdf-pages.ts) loads a native binary, which the bundler cannot place.
  serverExternalPackages: ["@napi-rs/canvas", "unpdf"],
  experimental: {
    // Evidence uploads go through a Server Action; the default cap is 1 MB. Files are limited to
    // 4 MB in src/lib/storage/evidence.ts — 5 MB here leaves room for multipart overhead.
    serverActions: { bodySizeLimit: "5mb" },
  },
};

export default nextConfig;
