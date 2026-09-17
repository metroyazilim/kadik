import type { ReactNode } from "react";
import "@/app/globals.css";

/**
 * Document root shared by every Kadik route. The public site has no
 * non-English route tree, so `lang` is always `"en"`; other languages are
 * served client-side by `components/GoogleTranslateWidget.tsx`.
 */
export default function KadikLayout({ children }: { children: ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
