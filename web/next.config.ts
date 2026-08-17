import type { NextConfig } from "next";
import { validateEnv } from "./src/env";

// Fail the build — not the first production request — when the deploy environment is
// misconfigured. Bypass with SKIP_ENV_VALIDATION=1 if you need to build without runtime config.
validateEnv();

/**
 * Applied to every response. Deliberately excludes a Content-Security-Policy: this app
 * renders user-saved code through Shiki and loads Google Fonts, so a CSP tight enough to
 * be worth having needs per-request nonces via `proxy.ts`. Better to ship no CSP than a
 * permissive one that reads as protection without being any.
 */
const securityHeaders = [
  // Don't let the browser second-guess a declared Content-Type (MIME sniffing → XSS).
  { key: "X-Content-Type-Options", value: "nosniff" },
  // No third party has any reason to frame this app; clickjacking has nothing to gain here.
  { key: "X-Frame-Options", value: "DENY" },
  // Send the full URL to ourselves, bare origin cross-site — entry IDs stay out of referers.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Nothing here uses these; deny by default rather than inherit the browser's permissions.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  // 2 years + preload-eligible. Vercel sets HSTS on its own domains; this covers custom ones.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  devIndicators: false,

  // Drop `X-Powered-By: Next.js` — free version disclosure, no upside.
  poweredByHeader: false,

  // `pg` opens raw TCP sockets and loads native-ish internals; bundling it breaks the
  // driver adapter in a serverless build. Keep it external.
  serverExternalPackages: ["pg"],

  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        // The health endpoint exists to report *current* state to uptime monitors —
        // a cached 200 would keep reporting healthy through an outage.
        source: "/api/health",
        headers: [{ key: "Cache-Control", value: "no-store, max-age=0" }],
      },
    ];
  },
};

export default nextConfig;
