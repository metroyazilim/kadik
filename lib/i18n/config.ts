// Locale registry. Turkish is the prefixless source language; English is the
// single Global locale under `/en`. Other languages are intentionally not
// first-class application locales and may be translated by the visitor's
// browser without creating duplicate routes or database revisions.
//
// Static-page paths (`/hakkimizda`, `/iletisim`, ...) and the permanent
// `/tr/*` redirect table live in `./static-pages.ts`, not here; see
// next.config.ts for how that table is wired in.

export const LOCALES = ["tr", "en"] as const;

export type Locale = (typeof LOCALES)[number];

/** Turkish is the source language; English is the Global translation. */
export const DEFAULT_LOCALE: Locale = "tr";

/** Both canonical locales use left-to-right writing direction. */
export const LOCALE_DIRS: Record<Locale, "ltr" | "rtl"> = {
  tr: "ltr",
  en: "ltr",
};

/** Product-facing names shown in the language switcher. */
export const LOCALE_NAMES: Record<Locale, string> = {
  tr: "Türkçe",
  en: "Global",
};

/**
 * BCP 47 tags for `<html lang>` / `hreflang` / `og:locale`. Deliberately
 * region-less (`tr`, not `tr-TR`): the copy is not written for one country and
 * a region tag would tell crawlers to only serve it there.
 */
export const LOCALE_TAGS: Record<Locale, string> = {
  tr: "tr",
  en: "en",
};

/** Underscored form Open Graph expects. */
export const OG_LOCALES: Record<Locale, string> = {
  tr: "tr_TR",
  en: "en_US",
};

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

/** Absolute site origin, used for canonical URLs, hreflang and the sitemap. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(
  /\/$/,
  "",
);

/**
 * Legacy locale-prefixed path helper retained for the dynamic English
 * collection bridges. Turkish uses `staticPath`; Global uses `/en`.
 */
export function localePath(locale: Locale, route: string): string {
  return `/${locale}${route}`;
}

/**
 * `alternates` block for `generateMetadata`: the canonical URL of this locale
 * plus every translation, with `x-default` pointing at the default locale.
 * Legacy pre-Spec-2 shape (always locale-prefixed); only the not-yet-cut-over
 * collection pages above still call this. New code uses `staticAlternates`.
 */
export function alternatesFor(locale: Locale, route: string) {
  const languages: Record<string, string> = {};
  for (const candidate of LOCALES) {
    languages[LOCALE_TAGS[candidate]] = `${SITE_URL}${localePath(candidate, route)}`;
  }
  languages["x-default"] = `${SITE_URL}${localePath(DEFAULT_LOCALE, route)}`;

  return {
    canonical: `${SITE_URL}${localePath(locale, route)}`,
    languages,
  };
}
