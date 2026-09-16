import { createHash } from "node:crypto";
import type { ContentLocale, PrismaClient } from "@prisma/client";
import { PersistedMappingPort } from "./persisted-mapping-port";
import { getPublishedRouteCandidates } from "./route-reader";
import { resolveLegacyOrUnknownAddress, type LegacyResolution } from "./public-route-resolution";

/** Fixed identity for every row this function writes - lets a future reader
 * distinguish "a real one-time legacy backfill mapping" (Story 0.5's own
 * `migrationVersion`s) from "a Story 6.2 fallback-to-native redirect alias"
 * sharing the same `LegacyMigrationMap` table. */
export const FALLBACK_REDIRECT_MIGRATION_VERSION = "seo-fallback-redirect-v1";
const FALLBACK_REDIRECT_SOURCE_TABLE = "route-alias";

export type RecordFallbackToNativeRedirectInput = Readonly<{
  entityId: string;
  locale: ContentLocale;
  collectionSegment: string;
  /** This entity's published Turkish slug, or `null` when it has none (no
   * Turkish source to alias from - nothing to redirect). */
  turkishSlug: string | null;
  newNativeSlug: string;
  targetTranslationId: string;
  targetRevisionId: string;
}>;

/**
 * Story 6.2 AC-6.2-04: called by each content-type `actions.ts` immediately
 * after `adminPublish()` returns `ok: true` for a locale that had no prior
 * `ContentRoute` (served only via Turkish fallback until now). Writes one
 * `LegacyMigrationMap` row - reusing Story 0.5's `PersistedMappingPort`
 * verbatim, never a bespoke Prisma insert or a new table - so a later
 * request to the previously-served fallback-alias address
 * (`{collectionSegment}/{turkishSlug}`) resolves through the existing,
 * unmodified `resolveLegacyOrUnknownAddress` to a redirect.
 *
 * A no-op (no row written) when there was no Turkish source to alias from,
 * or when the alias address already equals the new native address - no
 * redirect is needed when the previously-served URL and the newly-published
 * one are the same string.
 */
export async function recordFallbackToNativeRedirect(
  client: PrismaClient,
  input: RecordFallbackToNativeRedirectInput,
): Promise<void> {
  if (!input.turkishSlug) return;
  if (input.turkishSlug === input.newNativeSlug) return;

  const sourcePrimaryKey = `${input.collectionSegment}/${input.turkishSlug}`;
  const port = new PersistedMappingPort(client);

  // Idempotent: a later republish of the same entity/locale must never
  // throw on the unique-constraint it already satisfied the first time -
  // the alias address only needs recording once, ever.
  const existing = await port.lookupMapping(FALLBACK_REDIRECT_MIGRATION_VERSION, FALLBACK_REDIRECT_SOURCE_TABLE, sourcePrimaryKey);
  if (existing) return;

  await port.recordMapping({
    migrationVersion: FALLBACK_REDIRECT_MIGRATION_VERSION,
    sourceTable: FALLBACK_REDIRECT_SOURCE_TABLE,
    sourcePrimaryKey,
    sourceLocale: input.locale,
    sourceHash: createHash("sha256").update(sourcePrimaryKey).digest("hex"),
    targetEntityId: input.entityId,
    targetTranslationId: input.targetTranslationId,
    targetRevisionId: input.targetRevisionId,
    mappingMethod: "fallback-to-native-redirect",
    mappingConfidence: "high",
    approvedBy: null,
    migratedAt: new Date(),
  });
}

/**
 * Story 6.2 AC-6.2-04's redirect *consumer* - the only caller anywhere in
 * the repository of `resolveLegacyOrUnknownAddress` (Story 5.2 CAP-3,
 * previously unwired). Each native detail page calls this at its existing
 * "not found" branch, before falling through to `notFound()`: looks up a
 * `LegacyMigrationMap` row for this exact alias address (written by
 * `recordFallbackToNativeRedirect` above) and, if found, resolves it the
 * same way any other legacy address resolves. `collectionFallbackUrl` is
 * always `null` here (never a redirect to the collection page for an
 * unrelated missing slug) - this function's only job is the alias-redirect
 * case AC-6.2-04 requires, not a general legacy-URL policy expansion.
 *
 * A `redirect`-kind result's `url` is percent-encoded (`encodeURI`) before
 * being returned - `generateRoute`'s own output (which `resolveLegacyOrUnknownAddress`
 * reuses verbatim) is a raw native-script path, safe for an HTML `href` but
 * not for an HTTP `Location` header, which every real caller here passes it
 * straight into via `permanentRedirect()`. Encoding once at this boundary,
 * rather than at each of the 14 call sites, keeps `generateRoute`'s own
 * output format unchanged for every other consumer (canonical/hreflang).
 */
export async function resolveFallbackAliasRedirect(
  client: PrismaClient,
  locale: ContentLocale,
  collectionSegment: string,
  slug: string,
): Promise<LegacyResolution> {
  const port = new PersistedMappingPort(client);
  const mapping = await port.lookupMapping(FALLBACK_REDIRECT_MIGRATION_VERSION, FALLBACK_REDIRECT_SOURCE_TABLE, `${collectionSegment}/${slug}`);
  const targetRoutes = mapping ? await getPublishedRouteCandidates(client, mapping.targetEntityId) : [];
  const resolution = resolveLegacyOrUnknownAddress(mapping, targetRoutes, locale, null);
  return resolution.kind === "redirect" ? { ...resolution, url: encodeURI(resolution.url) } : resolution;
}
