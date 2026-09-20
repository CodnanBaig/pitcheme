import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  // Keep standalone tracing scoped to this app when a parent workspace also
  // contains a lockfile.
  outputFileTracingRoot: process.cwd(),
  // The serverless Chromium package resolves its compressed runtime assets at
  // execution time, so static tracing cannot discover them automatically.
  // The prebuild copies them out of pnpm's symlink tree so Vercel can package
  // regular files. Keep the include scoped to functions that need Chromium.
  outputFileTracingIncludes: {
    "/api/health": ["./.vercel-runtime/chromium/**/*"],
    "/api/export/**/*": ["./.vercel-runtime/chromium/**/*"],
  },
  async headers() {
    const developmentScriptPolicy = process.env.NODE_ENV === "production" ? "" : " 'unsafe-eval'"
    const securityHeaders = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=()",
      },
      {
        key: "Content-Security-Policy",
        value: [
          "default-src 'self'",
          `script-src 'self' 'unsafe-inline'${developmentScriptPolicy}`,
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data: blob: https:",
          "font-src 'self' data: https:",
          "connect-src 'self' https://openrouter.ai https://api.stripe.com",
          "frame-ancestors 'none'",
          "base-uri 'self'",
          "form-action 'self'",
        ].join("; "),
      },
      ...(process.env.NODE_ENV === "production"
        ? [{
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains; preload",
          }]
        : []),
    ]

    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
      {
        source: "/share/:token",
        headers: [
          { key: "Cache-Control", value: "private, no-store, max-age=0" },
          { key: "Referrer-Policy", value: "no-referrer" },
        ],
      },
    ]
  },
};

export default nextConfig;
