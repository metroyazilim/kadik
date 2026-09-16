import type { ContentLocale } from "@prisma/client";
import { generateRoute, type FallbackResolution, type PublishedRoute } from "./route-registry";

/**
 * Story 6.2's SEO composition/audit layer (CAP-1..CAP-4). Pure functions
 * only - no Prisma import, no I/O - mirroring `route-registry.ts`'s and
 * `public-route-resolution.ts`'s own purity precedent exactly. The
 * Prisma-touching companions that supply this file's arguments live in
 * `route-reader.ts` (`getAllPublishedRoutesForSitemap`),
 * `site-seo-defaults.ts` (`getSiteSeoDefaults`), and
 * `public-seo-redirect.ts` (`recordFallbackToNativeRedirect`).
 */

/** Site-level SEO defaults, derived from the real, already-shipped Story
 * 6.1 `PublicSiteSettings` (`brand.name` / `mission` / `brand.logo`) - see
 * `site-seo-defaults.ts`'s `getSiteSeoDefaults`. No new
 * Story 6.1 schema field is introduced. */
export type SiteSeoDefaults = Readonly<{
  siteName: string;
  defaultDescription: string;
  defaultOgImageUrl: string | null;
}>;

/** A resolved published translation's own locale SEO fields - already
 * authored by each content type's own vertical-slice story
 * (`payload-validation.ts`'s `seoTitle`/`seoDescription`, falling back to
 * `title`/`summary`-shaped content per that type's own read companion).
 * `structuredData` is a pure passthrough - no content type populates it
 * yet. */
export type ContentSeoPayload = Readonly<{
  title: string;
  description: string;
  ogImageUrl?: string;
  structuredData?: unknown;
}>;

export type SeoRobots = Readonly<{ index: boolean; follow: true }>;

export type SeoMetadata = Readonly<{
  title: string;
  description: string;
  canonical: string;
  robots: SeoRobots;
  ogTags: Readonly<{ title: string; description: string; image: string; url: string }>;
  structuredData?: unknown;
}>;

const TITLE_SEPARATOR = " | ";

/**
 * CAP-1: composes `generateMetadata()`-shape output from an already-resolved
 * route (`resolvePublicRoute`'s own `FallbackResolution` - never re-derived
 * here), a translation's own SEO payload, and site-level defaults. Returns
 * `null` when the route carries no indexable page (`notFound`) or its
 * content could not be resolved - the caller's own `notFound()`/redirect
 * handling is unaffected, this function never renders a response.
 *
 * The title separator is `" | "` exclusively (NFR-13) - `title` is always
 * `content.title + " | " + defaults.siteName`, no other separator is ever
 * emitted, replacing five duplicated production implementations that today
 * append no separator at all.
 */
export function composeSeoMetadata(
  route: FallbackResolution,
  content: ContentSeoPayload | null,
  defaults: SiteSeoDefaults,
): SeoMetadata | null {
  if (route.kind === "notFound" || content === null) return null;

  const canonical = route.kind === "native" ? route.url : route.canonical;
  const title = `${content.title}${TITLE_SEPARATOR}${defaults.siteName}`;
  const description = content.description.trim().length > 0 ? content.description : defaults.defaultDescription;
  const image = content.ogImageUrl ?? defaults.defaultOgImageUrl ?? "";

  return {
    title,
    description,
    canonical,
    robots: { index: route.kind === "native", follow: true },
    ogTags: { title, description, image, url: canonical },
    ...(content.structuredData === undefined ? {} : { structuredData: content.structuredData }),
  };
}

/**
 * CAP-1 companion: hreflang alternates from native URLs only - a
 * fallback-alias URL has no representable slot in `nativeUrlsByLocale`
 * (its type only ever holds native results), so exclusion is structural
 * (FR-9, AC-6.2-02), not a runtime filter that could regress.
 */
export function buildHreflangAlternates(
  nativeUrlsByLocale: ReadonlyMap<ContentLocale, string>,
): ReadonlyArray<Readonly<{ locale: string; url: string }>> {
  return Array.from(nativeUrlsByLocale.entries(), ([locale, url]) => ({ locale, url }));
}

export type SitemapRouteRow = Readonly<{ route: PublishedRoute; publishedAt: Date }>;

/**
 * CAP-2: one sitemap entry per real published route row. `url` is always
 * `generateRoute(route)` - never stored, never re-derived by string
 * concatenation. `rows` is sourced exclusively from real `ContentRoute`
 * rows by its own Prisma-touching companion, so a draft/archived/
 * fallback-alias address has no constructor that reaches this function.
 */
export function buildSitemapEntries(
  rows: readonly SitemapRouteRow[],
): ReadonlyArray<Readonly<{ url: string; locale: string; lastModified: string }>> {
  return rows.map((row) => ({
    url: generateRoute(row.route),
    locale: row.route.locale,
    lastModified: row.publishedAt.toISOString(),
  }));
}

const ADMIN_PATH_PREFIX = "/manage";

/** CAP-2: always disallows exactly `/manage` (the real, only admin path
 * prefix) and references the supplied sitemap URL. */
export function buildRobotsDirectives(sitemapUrl: string): Readonly<{
  rules: ReadonlyArray<Readonly<{ userAgent: "*"; disallow: readonly string[] }>>;
  sitemap: string;
}> {
  return {
    rules: [{ userAgent: "*", disallow: [ADMIN_PATH_PREFIX] }],
    sitemap: sitemapUrl,
  };
}

export type SeoAuditCategory =
  | "missingTitle"
  | "duplicateTitle"
  | "missingDescription"
  | "invalidDescription"
  | "canonicalMismatch"
  | "missingHreflang"
  | "invalidHreflang"
  | "unexpectedNoindex"
  | "orphanRoute";

export type SeoAuditFinding = Readonly<{
  category: SeoAuditCategory;
  severity: "blocking" | "warning";
  entityId: string;
  contentType: string;
  locale: string;
  detail: string;
  editorHref: string;
}>;

/** `PublishedRoute.contentType` is singular (`"service"`, `"team-member"`,
 * `"post"`, ...); the admin route segment is plural
 * (`components/admin/nav-items.ts`) - this is the one place that translates
 * between them, so a category-3 finding's `editorHref` always lands on the
 * real owning content's editor page. */
const ROUTE_SEGMENT_BY_CONTENT_TYPE: Readonly<Record<string, string>> = {
  service: "services",
  product: "products",
  project: "projects",
  "team-member": "team",
  post: "posts",
  faq: "faq",
};

function editorHrefFor(route: PublishedRoute): string {
  const segment = ROUTE_SEGMENT_BY_CONTENT_TYPE[route.contentType] ?? route.contentType;
  return `/manage/${segment}/${route.entityId}`;
}

/**
 * CAP-3: every finding is computed by re-running `buildSitemapEntries`'s
 * own `generateRoute` and comparing the actual composed output against the
 * expectation rule (presence, uniqueness, `navigationReachableUrls`
 * membership) - never a second, independently-drifting validation ruleset
 * (AC-6.2-05). Only categories this function has real signal for from its
 * own inputs are ever emitted; the remaining `SeoAuditCategory` members
 * stay reserved for a future finding source, never fabricated here.
 */
export function runSeoAudit(
  rows: readonly SitemapRouteRow[],
  contentByRoute: ReadonlyMap<string, ContentSeoPayload>,
  defaults: SiteSeoDefaults,
  navigationReachableUrls: ReadonlySet<string>,
): readonly SeoAuditFinding[] {
  const findings: SeoAuditFinding[] = [];
  const titleOwners = new Map<string, PublishedRoute[]>();
  const canonicalOwners = new Map<string, PublishedRoute[]>();

  for (const row of rows) {
    const url = generateRoute(row.route);
    const content = contentByRoute.get(url) ?? null;

    if (content === null || content.title.trim().length === 0) {
      findings.push({
        category: "missingTitle",
        severity: "blocking",
        entityId: row.route.entityId,
        contentType: row.route.contentType,
        locale: row.route.locale,
        detail: "Bu içerik için başlık tanımlanmamış.",
        editorHref: editorHrefFor(row.route),
      });
    } else {
      const owners = titleOwners.get(content.title) ?? [];
      owners.push(row.route);
      titleOwners.set(content.title, owners);
    }

    if (content !== null && content.description.trim().length === 0) {
      findings.push({
        category: "missingDescription",
        severity: "warning",
        entityId: row.route.entityId,
        contentType: row.route.contentType,
        locale: row.route.locale,
        detail: "Bu içerik için açıklama tanımlanmamış, varsayılan açıklama kullanılacak.",
        editorHref: editorHrefFor(row.route),
      });
    }

    // For a `kind: "native"` route, `composeSeoMetadata`'s own canonical is
    // always exactly `route.url` (`url` here) - reused directly rather than
    // reconstructing a throwaway SeoMetadata object just to read it back.
    if (content !== null) {
      const owners = canonicalOwners.get(url) ?? [];
      owners.push(row.route);
      canonicalOwners.set(url, owners);
    }

    if (!navigationReachableUrls.has(url)) {
      findings.push({
        category: "orphanRoute",
        severity: "warning",
        entityId: row.route.entityId,
        contentType: row.route.contentType,
        locale: row.route.locale,
        detail: "Bu sayfa site içi gezinme veya site haritasından erişilebilir değil.",
        editorHref: editorHrefFor(row.route),
      });
    }
  }

  for (const owners of titleOwners.values()) {
    if (owners.length < 2) continue;
    for (const owner of owners) {
      findings.push({
        category: "duplicateTitle",
        severity: "blocking",
        entityId: owner.entityId,
        contentType: owner.contentType,
        locale: owner.locale,
        detail: "Bu başlık başka bir yayınlanmış içerikle birebir aynı.",
        editorHref: editorHrefFor(owner),
      });
    }
  }

  for (const owners of canonicalOwners.values()) {
    if (owners.length < 2) continue;
    for (const owner of owners) {
      findings.push({
        category: "canonicalMismatch",
        severity: "blocking",
        entityId: owner.entityId,
        contentType: owner.contentType,
        locale: owner.locale,
        detail: "Bu canonical adres başka bir yayınlanmış içerikle çakışıyor.",
        editorHref: editorHrefFor(owner),
      });
    }
  }

  return findings;
}
