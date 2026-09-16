import { expect, test } from "@playwright/test";
import { generateRoute, type FallbackResolution, type PublishedRoute } from "../../lib/content-model/route-registry";

/**
 * Red-phase scaffold for `lib/content-model/public-seo.ts` (does not exist
 * yet - `bmad-build` creates it). Mirrors `story-3-1-service-contract.spec.ts`'s
 * `loadFutureModule` pattern: a computed template-string import specifier
 * types as `any` under TypeScript's dynamic-import checking, so this file
 * compiles cleanly today and only fails at *runtime* (module-not-found)
 * until the real module lands - exactly the red-phase contract this story
 * needs before implementation exists.
 */
async function loadFutureModule<T>(name: string): Promise<T> {
  const modulePath = `../../lib/content-model/${name}`;
  return import(modulePath) as Promise<T>;
}

type SeoRobots = Readonly<{ index: boolean; follow: true }>;

type ContentSeoPayload = Readonly<{
  title: string;
  description: string;
  ogImageUrl?: string;
  structuredData?: unknown;
}>;

type SeoMetadata = Readonly<{
  title: string;
  description: string;
  canonical: string;
  robots: SeoRobots;
  ogTags: Readonly<{ title: string; description: string; image: string; url: string }>;
  structuredData?: unknown;
}>;

type SiteSeoDefaults = Readonly<{
  siteName: string;
  defaultDescription: string;
  defaultOgImageUrl: string | null;
}>;

type SitemapRouteRow = Readonly<{ route: PublishedRoute; publishedAt: Date }>;

type SeoAuditFinding = Readonly<{
  category:
    | "missingTitle"
    | "duplicateTitle"
    | "missingDescription"
    | "invalidDescription"
    | "canonicalMismatch"
    | "missingHreflang"
    | "invalidHreflang"
    | "unexpectedNoindex"
    | "orphanRoute";
  severity: "blocking" | "warning";
  entityId: string;
  locale: string;
  detail: string;
  editorHref: string;
}>;

type PublicSeoModule = Readonly<{
  composeSeoMetadata(
    route: FallbackResolution,
    content: ContentSeoPayload | null,
    defaults: SiteSeoDefaults,
  ): SeoMetadata | null;
  buildHreflangAlternates(
    nativeUrlsByLocale: ReadonlyMap<"tr" | "en", string>,
  ): ReadonlyArray<Readonly<{ locale: string; url: string }>>;
  buildSitemapEntries(
    rows: readonly SitemapRouteRow[],
  ): ReadonlyArray<Readonly<{ url: string; locale: string; lastModified: string }>>;
  buildRobotsDirectives(sitemapUrl: string): Readonly<{
    rules: ReadonlyArray<Readonly<{ userAgent: "*"; disallow: readonly string[] }>>;
    sitemap: string;
  }>;
  runSeoAudit(
    rows: readonly SitemapRouteRow[],
    contentByRoute: ReadonlyMap<string, ContentSeoPayload>,
    defaults: SiteSeoDefaults,
    navigationReachableUrls: ReadonlySet<string>,
  ): readonly SeoAuditFinding[];
}>;

const DEFAULTS: SiteSeoDefaults = {
  siteName: "Corporate Starter",
  defaultDescription: "Corporate Starter - default description",
  defaultOgImageUrl: "https://example-starter.example/og-default.png",
};

const NATIVE_EN: FallbackResolution = { kind: "native", url: "https://example-starter.example/en/services/waste-audit" };
const FALLBACK_RU: FallbackResolution = {
  kind: "fallback",
  url: "https://example-starter.example/ru/услуги/atik-denetimi",
  canonical: "https://example-starter.example/servisler/atik-denetimi",
  noindex: true,
};
const NOT_FOUND: FallbackResolution = { kind: "notFound" };

const CONTENT: ContentSeoPayload = { title: "Waste Audit", description: "We audit industrial waste streams." };

function route(overrides: Partial<PublishedRoute> = {}): PublishedRoute {
  return {
    entityId: "ent-1",
    contentType: "service",
    locale: "en",
    collectionSegment: "services",
    slug: "waste-audit",
    ...overrides,
  };
}

test.describe("AC-6.2-01 - native metadata composition", () => {
  test("CAP-1 canonical equals resolvePublicRoute's own url, title ends with the exclusive | separator, robots is indexable", async () => {
    const { composeSeoMetadata } = await loadFutureModule<PublicSeoModule>("public-seo");
    const result = composeSeoMetadata(NATIVE_EN, CONTENT, DEFAULTS);

    expect(result).not.toBeNull();
    expect(result!.canonical).toBe(NATIVE_EN.url);
    expect(result!.title).toBe(`${CONTENT.title} | ${DEFAULTS.siteName}`);
    expect(result!.robots).toEqual({ index: true, follow: true });
  });

  test("CAP-1 never emits any separator other than exactly ' | '", async () => {
    const { composeSeoMetadata } = await loadFutureModule<PublicSeoModule>("public-seo");
    const result = composeSeoMetadata(NATIVE_EN, CONTENT, DEFAULTS);

    expect(result!.title.endsWith(` | ${DEFAULTS.siteName}`)).toBe(true);
    expect(result!.title).not.toContain(" — ");
    expect(result!.title).not.toContain(": ");
  });

  test("CAP-1 ogTags fall back to SiteSeoDefaults.defaultOgImageUrl when the content payload carries no ogImageUrl", async () => {
    const { composeSeoMetadata } = await loadFutureModule<PublicSeoModule>("public-seo");
    const result = composeSeoMetadata(NATIVE_EN, CONTENT, DEFAULTS);

    expect(result!.ogTags.image).toBe(DEFAULTS.defaultOgImageUrl);
  });
});

test.describe("AC-6.2-02 - fallback-alias noindex policy", () => {
  test("CAP-1 canonical equals the Turkish native URL verbatim, robots is exactly noindex/follow, never re-derived from the request", async () => {
    const { composeSeoMetadata } = await loadFutureModule<PublicSeoModule>("public-seo");
    const result = composeSeoMetadata(FALLBACK_RU, CONTENT, DEFAULTS);

    expect(result).not.toBeNull();
    expect(result!.canonical).toBe(FALLBACK_RU.canonical);
    expect(result!.robots).toEqual({ index: false, follow: true });
  });

  test("CAP-1 returns null for a notFound route - no indexable metadata object is ever produced", async () => {
    const { composeSeoMetadata } = await loadFutureModule<PublicSeoModule>("public-seo");
    expect(composeSeoMetadata(NOT_FOUND, null, DEFAULTS)).toBeNull();
  });

  test("buildHreflangAlternates never includes a fallback-alias URL as an alternate for any locale - the type only accepts native URLs", async () => {
    const { buildHreflangAlternates } = await loadFutureModule<PublicSeoModule>("public-seo");
    const natives = new Map<"tr" | "en", string>([
      ["tr", "https://example-starter.example/servisler/atik-denetimi"],
      ["en", "https://example-starter.example/en/services/waste-audit"],
    ]);
    const alternates = buildHreflangAlternates(natives);

    expect(alternates).toHaveLength(2);
    expect(alternates.some((entry) => entry.url === FALLBACK_RU.url)).toBe(false);
  });
});

test.describe("AC-6.2-03 - sitemap/robots exclusivity", () => {
  test("CAP-2 buildSitemapEntries returns exactly one entry per real PublishedRoute row, url always via generateRoute", async () => {
    const { buildSitemapEntries } = await loadFutureModule<PublicSeoModule>("public-seo");
    const rows: SitemapRouteRow[] = [
      { route: route({ locale: "tr", collectionSegment: "servisler", slug: "atik-denetimi" }), publishedAt: new Date("2026-01-01T00:00:00Z") },
      { route: route({ locale: "en", collectionSegment: "services", slug: "waste-audit" }), publishedAt: new Date("2026-01-02T00:00:00Z") },
    ];

    const entries = buildSitemapEntries(rows);

    expect(entries).toHaveLength(2);
    expect(entries[0]!.url).toContain("/servisler/atik-denetimi");
    expect(entries[0]!.lastModified).toBe("2026-01-01T00:00:00.000Z");
    expect(entries[1]!.url).toContain("/en/services/waste-audit");
  });

  test("CAP-2 buildRobotsDirectives references the supplied sitemap URL and always disallows exactly /manage", async () => {
    const { buildRobotsDirectives } = await loadFutureModule<PublicSeoModule>("public-seo");
    const directives = buildRobotsDirectives("https://example-starter.example/sitemap.xml");

    expect(directives.sitemap).toBe("https://example-starter.example/sitemap.xml");
    expect(directives.rules).toEqual([{ userAgent: "*", disallow: ["/manage"] }]);
  });
});

test.describe("AC-6.2-05 - audit findings never disagree with rendered output", () => {
  test("CAP-3 reports a distinct, correctly categorized finding for missing title, duplicate canonical, and an orphan route", async () => {
    const { runSeoAudit } = await loadFutureModule<PublicSeoModule>("public-seo");

    const missingTitleRoute = route({ entityId: "ent-missing", slug: "missing-title" });
    const dupA = route({ entityId: "ent-dup-a", slug: "dup-a" });
    const dupB = route({ entityId: "ent-dup-b", slug: "dup-b" });
    const orphan = route({ entityId: "ent-orphan", slug: "orphan" });

    const rows: SitemapRouteRow[] = [missingTitleRoute, dupA, dupB, orphan].map((r) => ({
      route: r,
      publishedAt: new Date("2026-01-01T00:00:00Z"),
    }));

    const contentByRoute = new Map<string, ContentSeoPayload>([
      // missingTitleRoute intentionally has no entry -> missingTitle finding.
      [generateRoute(dupA), { title: "Same Title", description: "d" }],
      [generateRoute(dupB), { title: "Same Title", description: "d" }],
      [generateRoute(orphan), { title: "Orphan Page", description: "d" }],
    ]);

    // navigationReachableUrls deliberately omits the orphan route's own url.
    const navigationReachableUrls = new Set<string>([generateRoute(dupA), generateRoute(dupB)]);

    const findings = runSeoAudit(rows, contentByRoute, DEFAULTS, navigationReachableUrls);

    expect(findings.some((f) => f.category === "missingTitle" && f.entityId === "ent-missing")).toBe(true);
    expect(findings.some((f) => f.category === "duplicateTitle")).toBe(true);
    expect(findings.some((f) => f.category === "orphanRoute" && f.entityId === "ent-orphan")).toBe(true);
    for (const finding of findings) {
      expect(finding.detail).not.toMatch(/at\s+.*\(.*:\d+:\d+\)/); // never a raw stack trace
      expect(finding.editorHref).toMatch(/^\/manage\/[a-z-]+\/[^/?]+$/);
    }
  });
});

test.describe("CAP-4 - seoIndexTag cache tag vocabulary", () => {
  test("cache-tags.ts exports seoIndexTag() returning the content:seo:index literal, matching navigationConfigTag()'s own convention", async () => {
    const { seoIndexTag } = await loadFutureModule<Readonly<{ seoIndexTag(): string }>>("cache-tags");
    expect(seoIndexTag()).toBe("content:seo:index");
  });
});
