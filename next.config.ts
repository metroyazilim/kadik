import type { NextConfig } from "next";

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
    value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' https://translate.google.com https://translate.googleapis.com https://translate-pa.googleapis.com; style-src 'self' 'unsafe-inline' https://www.gstatic.com https://fonts.googleapis.com; img-src 'self' blob: data: https:; font-src 'self' data:; connect-src 'self' https: https://translate.googleapis.com https://translate-pa.googleapis.com; frame-src https://translate.google.com https://translate.googleapis.com; object-src 'none'; frame-ancestors 'none';",
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
  // English is the site's only structural locale; there is no `/tr/*`
  // route tree. These rows carry forward the old bare-Turkish Kadik
  // addresses (and the pre-KADIK `/gonulluluk` campaign address) to their
  // English canonical home - see `KADIK_PATHS` in `lib/kadik-i18n.ts`.
  async redirects() {
    return [
      { source: "/hakkimizda", destination: "/about", permanent: true as const },
      { source: "/kurul-uyeleri", destination: "/board", permanent: true as const },
      { source: "/etkinlikler", destination: "/events", permanent: true as const },
      { source: "/uyelik", destination: "/membership", permanent: true as const },
      { source: "/duyurular", destination: "/announcements", permanent: true as const },
      { source: "/yazilar", destination: "/news", permanent: true as const },
      { source: "/yazilar/:slug", destination: "/news/:slug", permanent: true as const },
      { source: "/iletisim", destination: "/contact", permanent: true as const },
      { source: "/galeri", destination: "/gallery", permanent: true as const },
      { source: "/gizlilik-politikasi", destination: "/privacy-policy", permanent: true as const },
      { source: "/kullanim-sartlari", destination: "/terms", permanent: true as const },
      // Campaign-era membership address; predates `/uyelik` itself.
      { source: "/gonulluluk", destination: "/membership", permanent: true as const },
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
