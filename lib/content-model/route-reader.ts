import type { ContentLocale, PrismaClient } from "@prisma/client";
import type { PublishedRoute } from "./route-registry";

/**
 * The sanctioned, Prisma-backed way to fetch `PublishedRoute[]` for
 * `resolvePublicRoute` (`./route-registry.ts`). Deliberately the *only*
 * Prisma-touching function in the route-registry area - `route-registry.ts`
 * itself stays a pure policy module (no Prisma import, no I/O); this reader
 * is the data-access companion, mirroring `public-content-reader.ts`'s
 * separation of policy from access (Story 0.3).
 *
 * `ContentRoute.translationId` only cascades when the entire translation
 * row is deleted - setting `publishedRevisionId` back to null (a future
 * unpublish/archive mutation) is a plain update and does not, by itself,
 * remove the route row. Nothing in this slice implements such a mutation
 * yet, so today `ContentRoute` existing already implies its translation is
 * published. This query enforces that as an explicit, structural
 * invariant rather than an implicit one: it joins each route to its own
 * translation and filters out any row whose translation is not currently
 * published (`publishedRevisionId` is null), so a future unpublish
 * implementation - or any other direct-Prisma writer that could otherwise
 * leave a stale route behind - can never surface a route for unpublished
 * content through this reader.
 *
 * Read-only: no method here accepts a payload or opens a transaction.
 */
export async function getPublishedRouteCandidates(
  client: PrismaClient,
  entityId: string,
): Promise<PublishedRoute[]> {
  const rows = await client.contentRoute.findMany({
    where: { entityId, translation: { publishedRevisionId: { not: null } } },
    select: {
      entityId: true,
      contentType: true,
      locale: true,
      collectionSegment: true,
      slug: true,
    },
  });

  return rows.map(
    (row): PublishedRoute => ({
      entityId: row.entityId,
      contentType: row.contentType,
      locale: row.locale,
      collectionSegment: row.collectionSegment,
      slug: row.slug,
    }),
  );
}

/**
 * Reverse lookup for the exact `(contentType, locale, collectionSegment,
 * slug)` quadruple an incoming public URL parses into (Story 5.2 CAP-1).
 * Same published-only filter as `getPublishedRouteCandidates` above
 * (`translation.publishedRevisionId` not null), plus an explicit
 * `entity.archived: false` filter - an archived entity's route row can
 * still exist (archiving does not delete `ContentRoute`), but it must
 * never resolve publicly, mirroring `resolve()`'s own archived-entity
 * rejection (Story 5.1 AC-5.1-03). Returns every matching row (at most one,
 * per the `(contentType, locale, collectionSegment, slug)` unique index) as
 * an array, per this story's own interface contract - `resolveRouteIdentity`
 * does the exact-match selection, this reader never does.
 */
export async function getPublishedRouteCandidatesBySlug(
  client: PrismaClient,
  contentType: string,
  locale: ContentLocale,
  collectionSegment: string,
  slug: string,
): Promise<readonly PublishedRoute[]> {
  const rows = await client.contentRoute.findMany({
    where: {
      contentType,
      locale,
      collectionSegment,
      slug,
      translation: { publishedRevisionId: { not: null } },
      entity: { archived: false },
    },
    select: {
      entityId: true,
      contentType: true,
      locale: true,
      collectionSegment: true,
      slug: true,
    },
    orderBy: [{ collectionSegment: "asc" }, { entityId: "asc" }],
  });

  return rows.map(
    (row): PublishedRoute => ({
      entityId: row.entityId,
      contentType: row.contentType,
      locale: row.locale,
      collectionSegment: row.collectionSegment,
      slug: row.slug,
    }),
  );
}

/**
 * Reverse lookup for Story 5.2 CAP-2's Turkish-fallback-alias case: every
 * published Turkish `ContentRoute` row for this content type carrying the
 * requested slug, regardless of which locale/collection-segment prefix the
 * incoming request actually used. Same `entity.archived: false` exclusion
 * as `getPublishedRouteCandidatesBySlug` above. `(contentType, locale,
 * collectionSegment, slug)`'s unique index still bounds this to at most one
 * row per Turkish `collectionSegment` per content type, so the `orderBy` is
 * a determinism guard, not a correctness requirement, today - Turkish
 * carries exactly one collection segment per content type in this
 * repository's current registry.
 */
export async function getPublishedRouteCandidatesByTurkishSlug(
  client: PrismaClient,
  contentType: string,
  slug: string,
): Promise<readonly PublishedRoute[]> {
  const rows = await client.contentRoute.findMany({
    where: {
      contentType,
      locale: "tr",
      slug,
      translation: { publishedRevisionId: { not: null } },
      entity: { archived: false },
    },
    select: {
      entityId: true,
      contentType: true,
      locale: true,
      collectionSegment: true,
      slug: true,
    },
    orderBy: [{ collectionSegment: "asc" }, { entityId: "asc" }],
  });

  return rows.map(
    (row): PublishedRoute => ({
      entityId: row.entityId,
      contentType: row.contentType,
      locale: row.locale,
      collectionSegment: row.collectionSegment,
      slug: row.slug,
    }),
  );
}

/**
 * Story 6.2 CAP-2's sitemap read companion: every published, non-archived
 * `ContentRoute` row for one content type, joined to its owning
 * `ContentTranslation.publishedAt` for `lastModified` - `buildSitemapEntries`'s
 * actual input shape (`public-seo.ts`), never a bare `PublishedRoute[]`.
 * Same published-only + `entity.archived: false` filter as every other
 * reader in this file - a draft, archived, or never-published row has no
 * way to appear here.
 */
export async function getAllPublishedRoutesForSitemap(
  client: PrismaClient,
  contentType: string,
): Promise<ReadonlyArray<Readonly<{ route: PublishedRoute; publishedAt: Date }>>> {
  const rows = await client.contentRoute.findMany({
    where: {
      contentType,
      translation: { publishedRevisionId: { not: null } },
      entity: { archived: false },
    },
    select: {
      entityId: true,
      contentType: true,
      locale: true,
      collectionSegment: true,
      slug: true,
      translation: { select: { publishedAt: true } },
    },
    orderBy: [{ locale: "asc" }, { slug: "asc" }],
  });

  return rows.map((row) => ({
    route: {
      entityId: row.entityId,
      contentType: row.contentType,
      locale: row.locale,
      collectionSegment: row.collectionSegment,
      slug: row.slug,
    },
    // `publishedRevisionId: { not: null }` above guarantees `publishedAt`
    // is set - the pointer swap and the timestamp are written together in
    // the same `publish()` transaction (`publishing.ts`).
    publishedAt: row.translation.publishedAt!,
  }));
}
