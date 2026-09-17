import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "KADİK London | Coming Soon",
  description: "The KADİK London site is currently under construction. Please check back soon.",
  robots: { index: false, follow: false },
};

/**
 * Apex-domain holding page (`kadiklondon.org`). `proxy.ts` rewrites every
 * request on that host to this route while the real site stays reachable
 * on `staging.kadiklondon.org`. No header/footer/nav - this page must never
 * link back into the rest of the app, since the apex domain has nothing
 * else deployed on it yet.
 */
export default function ComingSoonPage() {
  return (
    <main
      style={{
        display: "grid",
        placeItems: "center",
        minHeight: "100vh",
        padding: "24px",
        background: "#07285f",
        color: "#fff",
        fontFamily: "Georgia, 'Times New Roman', serif",
        textAlign: "center",
      }}
    >
      <div style={{ maxWidth: 560 }}>
        <p style={{ margin: "0 0 18px", fontSize: 12, fontWeight: 700, letterSpacing: 3, color: "#9fb4e0", textTransform: "uppercase" }}>
          KADİK LONDON
        </p>
        <h1 style={{ margin: "0 0 20px", fontSize: "clamp(32px, 5vw, 48px)", lineHeight: 1.15 }}>
          We&apos;re building something new.
        </h1>
        <p style={{ margin: 0, color: "#c6d2ee", fontSize: 17, lineHeight: 1.7 }}>
          The KADİK London site is currently under construction. In the meantime, reach us at{" "}
          <a href="mailto:info@kadiklondon.org" style={{ color: "#fff", textDecoration: "underline" }}>
            info@kadiklondon.org
          </a>
          .
        </p>
      </div>
    </main>
  );
}
