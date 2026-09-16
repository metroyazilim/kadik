// Single dependency-free registry for Turkish-prefixless static pages.
// Turkish is served without a locale prefix; Global English uses `/en`.
// Imported by next.config.ts for the permanent `/tr/*` redirect table, so it
// must never import Prisma, `server-only`, React, or any content-model module.
//
// Collection keys (services/products/projects/team/blog) are NOT resolved
// here: their per-locale native-script segments already live in
// lib/content-model/*-routes.ts (`generateRoute`/`*_COLLECTION_SEGMENTS`,
// already AD-6 correct per spec-2.md \u00a72.1) and must not be duplicated or
// rewritten. `NavKey` exists so dictionary nav entries can reference either
// namespace with one closed union; resolving a `CollectionKey` happens in
// lib/public-content/site-shell-view.ts, the one place already allowed to
// import both this module and the content-model route segment maps.
import { DEFAULT_LOCALE, LOCALES, LOCALE_TAGS, SITE_URL, type Locale } from "./config";

export type StaticPageKey =
  | "home"
  | "about"
  | "contact"
  | "faq"
  | "search"
  | "missionVision"
  | "terms"
  | "privacy"
  | "partners";

export type CollectionKey = "services" | "products" | "projects" | "team" | "blog";

/** Every value a dictionary `nav`/`footer` entry may point at. */
export type NavKey = StaticPageKey | CollectionKey;

/**
 * Per-locale path segment for each static page. `""` means the locale root.
 * The English column also preserves the legacy English segment used by the
 * `/tr/<segment>` redirect source.
 */
const STATIC_SEGMENTS: Readonly<Record<StaticPageKey, Readonly<Record<Locale, string>>>> = {
  home: { tr: "", en: "" },
  about: { tr: "hakkimizda", en: "about" },
  contact: { tr: "iletisim", en: "contact" },
  faq: { tr: "sss", en: "faq" },
  search: { tr: "arama", en: "search" },
  missionVision: { tr: "misyon-ve-vizyon", en: "mission-vision" },
  terms: { tr: "kullanim-sartlari", en: "terms" },
  privacy: { tr: "gizlilik-politikasi", en: "privacy" },
  partners: { tr: "partnerler", en: "partners" },
};

export const STATIC_PAGE_KEYS = Object.keys(STATIC_SEGMENTS) as readonly StaticPageKey[];

export function isStaticPageKey(key: NavKey): key is StaticPageKey {
  return Object.prototype.hasOwnProperty.call(STATIC_SEGMENTS, key);
}

/**
 * Reverse lookup for `LanguageSwitcher`: resolves the current locale's first
 * path segment to one of the eight static page keys.
 */
export function findStaticPageKeyBySegment(locale: Locale, segment: string): StaticPageKey | null {
  if (segment === "") return "home";
  for (const key of STATIC_PAGE_KEYS) {
    if (key !== "home" && STATIC_SEGMENTS[key][locale] === segment) return key;
  }
  return null;
}

/** Turkish is prefixless; every other locale keeps its `/<locale>` prefix. */
export function staticPath(locale: Locale, key: StaticPageKey): string {
  const segment = STATIC_SEGMENTS[key][locale];
  if (locale === "tr") return segment ? `/${segment}` : "/";
  return segment ? `/${locale}/${segment}` : `/${locale}`;
}

export type Alternates = Readonly<{ canonical: string; languages: Readonly<Record<string, string>> }>;

/** Drop-in replacement for the old locale-config `alternatesFor`, scoped to static pages. */
export function staticAlternates(locale: Locale, key: StaticPageKey): Alternates {
  const languages: Record<string, string> = {};
  for (const candidate of LOCALES) {
    languages[LOCALE_TAGS[candidate]] = `${SITE_URL}${staticPath(candidate, key)}`;
  }
  languages["x-default"] = `${SITE_URL}${staticPath(DEFAULT_LOCALE, key)}`;

  return { canonical: `${SITE_URL}${staticPath(locale, key)}`, languages };
}

export type StaticRedirect = Readonly<{ source: string; destination: string; permanent: true }>;

/**
 * The one place `/tr/*` and the legacy prefixless `/about` get mapped to
 * their permanent (308) prefixless-Turkish destination. Consumed only by
 * next.config.ts. Specific rows are returned before the trailing
 * `/tr/:path*` catch-all so explicit segment translations always win; the
 * catch-all exists so no future `/tr/...` link can ever render duplicate
 * content, even for an address with no dedicated row.
 *
 * Collection segments (`servisler`, `urunler`, `projeler`, `ekip`, `blog`)
 * are the same stable Turkish values `lib/content-model/*-routes.ts`
 * exports - duplicated here as literals, not imported, specifically to
 * keep this module free of any content-model import next.config.ts would
 * otherwise have to bundle (see spec-2.md \u00a714.1 "next.config.ts import
 * weight").
 */
export function buildStaticRedirects(): StaticRedirect[] {
  const rows: StaticRedirect[] = [];

  rows.push({ source: "/tr", destination: "/", permanent: true });
  rows.push({ source: "/about", destination: staticPath("tr", "about"), permanent: true });
  // The Turkish mission/vision address changed from `misyon-vizyon` to
  // `misyon-ve-vizyon`; the old one stays permanently redirected so links
  // and indexed results keep resolving.
  rows.push({ source: "/misyon-vizyon", destination: staticPath("tr", "missionVision"), permanent: true });

  for (const key of STATIC_PAGE_KEYS) {
    if (key === "home") continue; // legacy Turkish home was bare `/tr`, handled above.
    rows.push({
      source: `/tr/${STATIC_SEGMENTS[key].en}`,
      destination: staticPath("tr", key),
      permanent: true,
    });
  }

  const collectionRedirects: ReadonlyArray<readonly [string, string]> = [
    ["services", "servisler"],
    ["products", "urunler"],
    ["projects", "projeler"],
  ];
  for (const [legacyEnglish, turkish] of collectionRedirects) {
    rows.push({ source: `/tr/${legacyEnglish}`, destination: `/${turkish}`, permanent: true });
    rows.push({
      source: `/tr/${legacyEnglish}/:slug`,
      destination: `/${turkish}/:slug`,
      permanent: true,
    });
  }
  rows.push({ source: "/tr/team/:slug", destination: "/ekip/:slug", permanent: true });
  rows.push({ source: "/tr/blog", destination: "/blog", permanent: true });
  rows.push({ source: "/tr/blog/:slug", destination: "/blog/:slug", permanent: true });

  rows.push({ source: "/tr/:path*", destination: "/:path*", permanent: true });

  return rows;
}
