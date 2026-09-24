import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow production builds to complete even if there are ESLint issues.
  // We still keep ESLint in dev, but do not fail CI builds on lint errors.
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Required by @opennextjs/cloudflare (Cloudflare Workers deploy).
  // The GitHub Pages workflow overrides this with `output: 'export'`
  // via actions/configure-pages at build time.
  output: "standalone",
};

export default nextConfig;
