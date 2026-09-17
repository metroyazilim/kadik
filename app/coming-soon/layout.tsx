import type { ReactNode } from "react";

/**
 * Standalone document root for the apex-domain holding page. Deliberately
 * does not reuse `KadikLayout`/`globals.css`: this route must render
 * correctly even if the rest of the app's styling pipeline is broken, and
 * must never pull in Kadik nav/brand assets that imply the full site is
 * live on this domain.
 */
export default function ComingSoonLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
