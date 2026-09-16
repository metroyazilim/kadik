import type { ContentLocale } from "@prisma/client";
import { contentAvailabilityTag, contentEntityTag, navigationConfigTag } from "./cache-tags";
import { generateRoute, resolvePublicRoute, type PublishedRoute } from "./route-registry";

export type LocaleSwitchTarget =
  | Readonly<{ kind: "native"; url: string }>
  | Readonly<{ kind: "fallbackAlias"; url: string; canonical: string; noindex: true }>
  | Readonly<{ kind: "collectionFallback"; url: string }>
  | Readonly<{ kind: "disabled" }>;

/**
 * Story 5.4 CAP-1: given a stable `entityId` and a target locale, returns
 * exactly one of the four safe outcomes `EXPERIENCE.md`'s Locale switcher
 * row fixes: native, fallback-alias, a content-type collection-page
 * target, or disabled. Reuses Story 0.4's `resolvePublicRoute` for the
 * native/notFound classification (never a second, parallel algorithm,
 * AC-5.4-05) - but `resolvePublicRoute`'s own "fallback" branch returns the
 * *Turkish* URL (`url === canonical`, Story 0.4's frozen contract), not the
 * target-locale-prefixed alias `EXPERIENCE.md` requires ("hedef locale
 * segmenti + Türkçe slug fallback alias'ına geçer, `/en/services/{turkceSlug}`"
 * - the visible address stays under the target locale's own prefix/segment,
 * never the Turkish one). Building that alias address requires the target
 * locale's own collection segment for this content type, which no generic
 * function in this Epic 5 lane owns (that per-content-type mapping is
 * Epic 3+'s own registration) - so it is caller-supplied input here,
 * exactly like `resolveMediaOrFallback`'s hostname allowlist and
 * `route-registry.ts`'s own `collectionSegment` are caller-supplied
 * config, never a literal baked into this policy code. When the caller
 * cannot supply it (content type not yet registered anywhere), this
 * degrades safely to the Turkish canonical URL - still a real, valid,
 * non-404 address - rather than inventing one.
 */
export function resolveLocaleSwitchTarget(
  entityId: string,
  targetLocale: ContentLocale,
  entityRoutes: readonly PublishedRoute[],
  targetLocaleCollectionSegment: string | null,
  collectionFallbackUrl: string | null,
): LocaleSwitchTarget {
  const resolved = resolvePublicRoute(entityId, targetLocale, entityRoutes);

  if (resolved.kind === "native") {
    return { kind: "native", url: resolved.url };
  }
  if (resolved.kind === "fallback") {
    const turkishRoute = entityRoutes.find(
      (route) => route.entityId === entityId && route.locale === "tr",
    );
    if (turkishRoute && targetLocaleCollectionSegment) {
      const aliasUrl = generateRoute({
        contentType: turkishRoute.contentType,
        locale: targetLocale,
        collectionSegment: targetLocaleCollectionSegment,
        slug: turkishRoute.slug,
      });
      return { kind: "fallbackAlias", url: aliasUrl, canonical: resolved.canonical, noindex: true };
    }
    return { kind: "fallbackAlias", url: resolved.url, canonical: resolved.canonical, noindex: true };
  }

  if (collectionFallbackUrl) {
    return { kind: "collectionFallback", url: collectionFallbackUrl };
  }
  return { kind: "disabled" };
}

/**
 * One navigation-configuration entry, before resolution - `composeNavigation`
 * performs no resolution of its own, only the renderability filter (Story
 * 5.4 CAP-2). An `entity` entry's target is resolved by the caller via
 * `resolveLocaleSwitchTarget` above (the forward, entity-to-URL direction -
 * never Story 5.2's `resolveRouteIdentity`, which is the reverse,
 * URL-to-entity direction and has no URL to give a menu link); a
 * `fragment` entry (an in-page anchor into a Home section) is checked
 * against the section keys Epic 2's own composer actually rendered this
 * pass - never a criterion looser than what the actual target would
 * itself require to render.
 */
export type NavEntryTarget =
  | Readonly<{ kind: "entity"; entityId: string }>
  | Readonly<{ kind: "fragment"; sectionId: string }>;

export type NavEntryConfig = Readonly<{ id: string; labelKey: string; target: NavEntryTarget }>;

export type RenderableNavEntry = Readonly<{ id: string; labelKey: string; url: string }>;

/**
 * Story 5.4 CAP-2: only the subset of `config` whose target actually
 * resolves to a renderable, linkable state survives, in stable input
 * order (mirrors AD-7's "unrenderable section drops its anchor" applied to
 * nav-level links). A dangling in-page fragment whose section does not
 * render is dropped, never rendered pointing at nothing (AC-5.4-03); an
 * entity target with no `resolvedTargets` entry, or one that resolved to
 * `collectionFallback`/`disabled`, is dropped the same way, never shown
 * with a dead or misleading `href` (AC-5.4-02) - only `native`/
 * `fallbackAlias` targets carry a real per-entity address.
 */
export function composeNavigation(
  config: readonly NavEntryConfig[],
  resolvedTargets: ReadonlyMap<string, LocaleSwitchTarget>,
  renderedFragmentIds: ReadonlySet<string>,
): readonly RenderableNavEntry[] {
  const output: RenderableNavEntry[] = [];
  for (const entry of config) {
    if (entry.target.kind === "entity") {
      const resolved = resolvedTargets.get(entry.id);
      if (resolved && (resolved.kind === "native" || resolved.kind === "fallbackAlias")) {
        output.push({ id: entry.id, labelKey: entry.labelKey, url: resolved.url });
      }
      continue;
    }
    if (renderedFragmentIds.has(entry.target.sectionId)) {
      output.push({ id: entry.id, labelKey: entry.labelKey, url: `#${entry.target.sectionId}` });
    }
  }
  return output;
}

/**
 * Story 5.4 CAP-3: the cache-dependency tags a rendered navigation actually
 * depends on - computed only over `entries` that `composeNavigation`
 * already kept (a dropped, unrendered entity target cannot invalidate
 * anything it never rendered). Each tag is imported from Story 5.1's
 * shared `cache-tags.ts`, never a second, independently formatted string.
 * `navigationConfigTag()` is always included: the nav/footer configuration
 * itself can invalidate independent of any single entity's publish state.
 */
export function navigationDependencyTags(
  entries: readonly RenderableNavEntry[],
  entityIdByNavEntryId: ReadonlyMap<string, string>,
  requestedLocale: ContentLocale,
): readonly string[] {
  const tags = new Set<string>([navigationConfigTag()]);
  for (const entry of entries) {
    const entityId = entityIdByNavEntryId.get(entry.id);
    if (!entityId) continue;
    tags.add(contentEntityTag(entityId));
    tags.add(contentAvailabilityTag(entityId, requestedLocale));
  }
  return [...tags];
}
