import type { ContentLocale } from "@prisma/client";
import { ContentModelError } from "./errors";
import {
  generateRoute,
  normalizeRouteSegment,
  resolvePublicRoute,
  type PublishedRoute,
} from "./route-registry";

/**
 * `resolveRouteIdentity`'s already-fetched candidate rows - never queried by
 * the function itself (pure, no Prisma, mirroring `route-registry.ts`'s
 * CAP-1 purity exactly). `nativeCandidates` comes from
 * `route-reader.ts`'s `getPublishedRouteCandidatesBySlug` (scoped to the
 * exact requested `(contentType, locale, collectionSegment, slug)`);
 * `turkishCandidates` comes from `getPublishedRouteCandidatesByTurkishSlug`
 * (scoped to `(contentType, locale: "tr", slug)` only). Both already
 * exclude an archived entity's route and a not-currently-published one.
 */
export type RouteIdentityResult =
  | Readonly<{ kind: "native"; entityId: string; url: string }>
  | Readonly<{ kind: "fallbackAlias"; entityId: string; canonical: string; noindex: true }>
  | Readonly<{ kind: "notFound" }>
  | Readonly<{ kind: "invalidInput"; message: string }>;

/**
 * The reverse of Story 0.4's `generateRoute` (Story 5.2 CAP-1/CAP-2): turns
 * a parsed `(contentType, locale, collectionSegment, slug)` triple into the
 * stable `entityId` a route names. Every segment is re-normalized through
 * Story 0.4's *existing* `normalizeRouteSegment` before any comparison - a
 * value that fails normalization is rejected with a safe classified
 * `invalidInput` result before either candidate list is even inspected
 * (AC-5.2-04), never silently passed through to a lookup that already ran.
 *
 * Native resolution (CAP-1) always wins: `nativeCandidates` is searched
 * first, and only a candidate whose own fields match the *normalized*
 * request exactly is accepted - never trusted blindly from the caller's
 * query alone. The fallback-alias branch (CAP-2) is reached only when no
 * native candidate matched, only for a non-Turkish requested locale (`tr`
 * is the source locale - AD-6/A-4 - so a Turkish request that misses
 * native has no further fallback to check, mirroring Story 5.1's
 * `resolveContentFallback` short-circuit exactly), and only for a
 * candidate whose own `locale` field is genuinely `"tr"` (re-checked here,
 * never trusted merely because the reader's query happened to filter on
 * it). Its `canonical` is `generateRoute(turkishMatch)` directly - the
 * matched Turkish row already *is* the canonical Turkish route, so this
 * never needs a second `resolvePublicRoute` call (which would otherwise
 * risk mis-classifying this as `native` whenever the same entity also
 * happens to have unrelated native content in the requested locale under
 * a different slug - the exact URL requested here already failed the
 * native check above, so it is never a canonical address in the requested
 * locale regardless of what else that entity publishes there).
 */
export function resolveRouteIdentity(
  input: Readonly<{
    contentType: string;
    locale: ContentLocale;
    collectionSegment: string;
    slug: string;
  }>,
  nativeCandidates: readonly PublishedRoute[],
  turkishCandidates: readonly PublishedRoute[],
): RouteIdentityResult {
  let normalizedCollectionSegment: string;
  let normalizedSlug: string;
  try {
    normalizedCollectionSegment = normalizeRouteSegment(
      input.locale,
      "collectionSegment",
      input.collectionSegment,
    );
    normalizedSlug = normalizeRouteSegment(input.locale, "slug", input.slug);
  } catch (error) {
    if (error instanceof ContentModelError) {
      return { kind: "invalidInput", message: error.message };
    }
    throw error;
  }

  const nativeMatch = nativeCandidates.find(
    (candidate) =>
      candidate.contentType === input.contentType &&
      candidate.locale === input.locale &&
      candidate.collectionSegment === normalizedCollectionSegment &&
      candidate.slug === normalizedSlug,
  );
  if (nativeMatch) {
    return { kind: "native", entityId: nativeMatch.entityId, url: generateRoute(nativeMatch) };
  }

  if (input.locale !== "tr") {
    const turkishMatch = turkishCandidates.find(
      (candidate) =>
        candidate.locale === "tr" &&
        candidate.contentType === input.contentType &&
        candidate.slug === normalizedSlug,
    );
    if (turkishMatch) {
      return {
        kind: "fallbackAlias",
        entityId: turkishMatch.entityId,
        canonical: generateRoute(turkishMatch),
        noindex: true,
      };
    }
  }

  return { kind: "notFound" };
}

export type LegacyResolution =
  | Readonly<{ kind: "redirect"; entityId: string; url: string }>
  | Readonly<{ kind: "notFound" }>
  | Readonly<{ kind: "collection"; url: string }>;

/**
 * Story 5.2 CAP-3: a legacy or unverified address never invents a redirect
 * target. `mapping` must already name a real, currently-resolvable entity
 * (Story 0.5's `LegacyMigrationMap`, read by the caller) - with no mapping,
 * or a mapped entity with no published route anywhere (`resolvePublicRoute`
 * itself returns `notFound`), this falls through to a caller-supplied
 * content-type collection page or a safe `notFound`, never a guessed
 * address. The redirect target is computed exclusively via
 * `resolvePublicRoute`, the same function CAP-2 reuses - no second,
 * independently-built URL.
 */
export function resolveLegacyOrUnknownAddress(
  mapping: Readonly<{ targetEntityId: string }> | null,
  targetEntityRoutes: readonly PublishedRoute[],
  requestedLocale: ContentLocale,
  collectionFallbackUrl: string | null,
): LegacyResolution {
  if (mapping) {
    const resolved = resolvePublicRoute(mapping.targetEntityId, requestedLocale, targetEntityRoutes);
    if (resolved.kind !== "notFound") {
      return { kind: "redirect", entityId: mapping.targetEntityId, url: resolved.url };
    }
  }

  if (collectionFallbackUrl) {
    return { kind: "collection", url: collectionFallbackUrl };
  }
  return { kind: "notFound" };
}
