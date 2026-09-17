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
  // English is the site's native/default locale; Turkish lives under
  // `/tr/*`. The legacy Metro-starter multi-locale redirect table
  // (`buildStaticRedirects`) assumed the opposite (Turkish prefixless
  // canonical, `/tr/*` always redirected away) and would 308 every real
  // `/tr/...` Kadik page straight back to English - removed, not reused.
  // These rows only carry forward the old bare-Turkish Kadik addresses to
  // their new `/tr/...` home.
  async redirects() {
    return [
      { source: "/hakkimizda", destination: "/tr/hakkimizda", permanent: true as const },
      { source: "/kurul-uyeleri", destination: "/tr/kurul-uyeleri", permanent: true as const },
      { source: "/etkinlikler", destination: "/tr/etkinlikler", permanent: true as const },
      { source: "/uyelik", destination: "/tr/uyelik", permanent: true as const },
      { source: "/duyurular", destination: "/tr/duyurular", permanent: true as const },
      { source: "/yazilar", destination: "/tr/yazilar", permanent: true as const },
      { source: "/yazilar/:slug", destination: "/tr/yazilar/:slug", permanent: true as const },
      { source: "/iletisim", destination: "/tr/iletisim", permanent: true as const },
      { source: "/galeri", destination: "/tr/galeri", permanent: true as const },
      { source: "/gizlilik-politikasi", destination: "/tr/gizlilik-politikasi", permanent: true as const },
      { source: "/kullanim-sartlari", destination: "/tr/kullanim-sartlari", permanent: true as const },
      // Campaign-era membership address; predates `/uyelik` itself.
      { source: "/gonulluluk", destination: "/tr/uyelik", permanent: true as const },
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
