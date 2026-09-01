import type { NextConfig } from "next";

// Security headers are set per request in middleware.ts rather than here,
// because the CSP carries a nonce and the referrer policy differs on share
// routes. Static config cannot do either.
const nextConfig: NextConfig = {
  // Emits a self-contained server bundle, so the container image does not need
  // node_modules. Required for the Docker deploy described in DEPLOY.md.
  output: 'standalone',
};

export default nextConfig;
