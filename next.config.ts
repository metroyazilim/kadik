import type { NextConfig } from "next";
import { buildStaticRedirects } from "./lib/i18n/static-pages";

const securityHeaders = [
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "X-DNS-Prefetch-Control",
    value: "on",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: "Content-Security-Policy",
    value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data: https:; font-src 'self' data:; connect-src 'self' https:; object-src 'none'; frame-ancestors 'none';",
  },
];

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  // Docker image copies `.next/standalone`; see Dockerfile.
  output: "standalone",
  // `next dev` otherwise drops its own AGENTS.md/CLAUDE.md into the workspace.
  // The clone contract comes from the generation prompt; a second, generic rule
  // file in the same directory would compete with it.
  agentRules: false,
  // Spec 2: every `/tr/*` address and the legacy prefixless `/about`
  // permanently (308) redirect to their Turkish-prefixless equivalent,
  // generated from the one registry `buildStaticRedirects()` owns - never
  // hand-typed here. Config-level redirects run before the app router, so a
  // `/tr/*` request never reaches a render or touches the database.
  async redirects() {
    return [
      ...buildStaticRedirects(),
      // Üyelik sayfası kampanya döneminden kalan `/gonulluluk` adresinden
      // Türkçe `/uyelik` segmentine taşındı; eski adres kalıcı yönlenir.
      { source: "/gonulluluk", destination: "/uyelik", permanent: true as const },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
