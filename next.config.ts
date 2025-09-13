import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow production builds to complete even if there are ESLint issues.
  // We still keep ESLint in dev, but do not fail CI builds on lint errors.
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
