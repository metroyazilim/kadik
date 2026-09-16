import Link from "next/link";
import { LOCALES, LOCALE_NAMES, type Locale } from "@/lib/i18n/config";

/**
 * Per-locale switch for the locale-partitioned content lists (services,
 * products, projects, team, faq, posts each keep one physical table per
 * locale - see AGENTS.md). Full-page navigation via `<Link>`, matching the
 * pre-existing behavior; this only replaces the inline public-token classes.
 */
export function LocaleTabs({ basePath, current, label }: { basePath: string; current: Locale; label: string }) {
  return (
    <nav className="mb-6 flex flex-wrap gap-1.5" aria-label={label}>
      {LOCALES.map((candidate) => {
        const active = candidate === current;
        return (
          <Link
            key={candidate}
            href={`${basePath}?locale=${candidate}`}
            aria-current={active ? "page" : undefined}
            className={`rounded-lg px-3.5 py-2 text-sm font-medium transition ${
              active ? "bg-brand-primary text-white" : "bg-brand-page text-brand-muted hover:text-brand-text"
            }`}
          >
            {LOCALE_NAMES[candidate]}
          </Link>
        );
      })}
    </nav>
  );
}
