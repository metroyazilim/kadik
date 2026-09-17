import type { ReactNode } from "react";
import "@/app/globals.css";

/**
 * Document root shared by every Kadik route. `lang` defaults to English -
 * the site's native locale - and is overridden to `"tr"` by the `/tr/*`
 * route layouts. `globals.css`'s `--kadik-*` tokens are plain system fonts
 * (Georgia/Arial), so this needs no Google Fonts wiring the way the legacy
 * `[locale]/layout.tsx` does.
 */
export default function KadikLayout({ children, lang = "en" }: { children: ReactNode; lang?: "en" | "tr" }) {
  return <html lang={lang}><body>{children}</body></html>;
}
