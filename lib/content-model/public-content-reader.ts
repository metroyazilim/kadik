import type { ContentLocale, Prisma, PrismaClient } from "@prisma/client";
import { blockFieldsFor } from "./block-field-registry";
import { contentAvailabilityTag, contentEntityTag, contentRevisionTag } from "./cache-tags";
import { sanitizePayloadBlockFields } from "./content-blocks";
import { resolveContentFallback } from "./public-fallback-policy";
import { PublishedContentStore, type PublishedContentSource } from "./published-content-store";
import { richTextFieldsFor } from "./rich-text-field-registry";
import { generateRoute } from "./route-registry";
import { sanitizeCanonicalPayload } from "./sanitization";

/** Applies both the flat rich-text and typed-block defense-in-depth re-sanitization passes for `contentType`'s registered fields (Story 5.1 CAP-2). */
function sanitizeCanonicalPayloadForType(payload: Prisma.JsonValue, contentType: string): Prisma.JsonValue {
  const flatSanitized = sanitizeCanonicalPayload(payload, richTextFieldsFor(contentType));
  return sanitizePayloadBlockFields(flatSanitized, blockFieldsFor(contentType));
}

/**
 * `PublicContentReader`'s safe read projection (Story 0.3 CAP-3). Built
 * field-by-field, never `{ ...row }` spread, so a future schema addition to
 * `ContentTranslation`/`ContentTranslationRevision` (e.g. an internal
 * audit-linkage column) cannot silently widen what a public caller sees.
 * Deliberately carries no `draftRevisionId`, `createdBy`, or audit field -
 * not merely omitted by a TypeScript type, but never read off the row in
 * the first place.
 */
export type PublicTranslationProjection = Readonly<{
  entityId: string;
  locale: ContentLocale;
  publishedRevisionId: string;
  schemaVersion: number;
  payload: Prisma.JsonValue;
  publishedAt: Date;
  version: number;
}>;

export type GetPublishedInput = Readonly<{
  entityId: string;
  locale: ContentLocale;
}>;

/**
 * Read-only by construction: this module imports nothing from
 * `./publishing.ts`, `./admin-content-store.ts`, or `./admin-context.ts`,
 * and exposes no method that accepts a payload or opens a transaction - so
 * no external caller can reach a mutation capability through this reader
 * even by mistake.
 *
 * A single query, not two. `ContentTranslation.publishedRevision` is a
 * schema-level relation resolved by `publishedRevisionId`'s own foreign
 * key, so traversing it from the requested translation's own row makes the
 * returned revision *structurally* guaranteed to belong to that
 * translation - there is no second, independently-filtered query whose
 * result could belong to a different translation, and no window between
 * two round trips in which a concurrent publish could swap which revision
 * is current (a single SQL statement is one consistent snapshot; two
 * sequential `await`s are two separate ones). `publishedRevisionId` is
 * checked from the *same* row that was just read, not re-fetched.
 *
 * Returns `null` immediately when the translation has no
 * `publishedRevisionId` - the join contributes no extra query in that case
 * either, so a draft payload can never leak through this path even
 * accidentally. This slice resolves exactly the `(entityId, locale)` pair
 * requested; locale-fallback selection is Story 0.4's contract, not
 * reproduced here (per `SPEC.md`'s constraints).
 */
export async function getPublished(
  client: PrismaClient,
  input: GetPublishedInput,
): Promise<PublicTranslationProjection | null> {
  const translation = await client.contentTranslation.findUnique({
    where: { entityId_locale: { entityId: input.entityId, locale: input.locale } },
    select: {
      entityId: true,
      locale: true,
      publishedRevisionId: true,
      publishedAt: true,
      version: true,
      publishedRevision: { select: { schemaVersion: true, payload: true } },
    },
  });
  if (!translation?.publishedRevisionId || !translation.publishedRevision || !translation.publishedAt) {
    return null;
  }

  return {
    entityId: translation.entityId,
    locale: translation.locale,
    publishedRevisionId: translation.publishedRevisionId,
    schemaVersion: translation.publishedRevision.schemaVersion,
    payload: translation.publishedRevision.payload,
    publishedAt: translation.publishedAt,
    version: translation.version,
  };
}

/**
 * AD-5's `PublicProjectionResult`. Additive alongside `getPublished` above -
 * that function's exact `(entityId, locale)`-only, no-fallback contract and
 * its callers/tests are unchanged. `payload` is `null` on every empty
 * branch (never omitted/undefined, per AC-5.1-02); `canonical` is set only
 * on the Turkish-fallback branch (this entity's own published Turkish
 * route, per AC-5.1-01) - the native branch never needs one, since the
 * requested locale's own URL already is the canonical address.
 */
export type PublicProjectionEmptyReason =
  | "no-entity"
  | "no-translation"
  | "no-published-any-locale"
  | "source-error";

export type CacheDependencySet = Readonly<{ tags: readonly string[] }>;

export type PublicProjectionResult = Readonly<{
  entityId: string;
  contentType: string;
  requestedLocale: ContentLocale;
  servedLocale: ContentLocale | null;
  servedRevisionId: string | null;
  fallbackApplied: boolean;
  payload: Prisma.JsonValue | null;
  canonical: Readonly<{ url: string; noindex: boolean }> | null;
  cacheDependencies: CacheDependencySet;
  emptyReason: PublicProjectionEmptyReason | null;
}>;

function emptyProjection(
  input: Readonly<{ entityId: string; contentType: string; requestedLocale: ContentLocale }>,
  emptyReason: PublicProjectionEmptyReason,
  tags: readonly string[],
): PublicProjectionResult {
  return {
    entityId: input.entityId,
    contentType: input.contentType,
    requestedLocale: input.requestedLocale,
    servedLocale: null,
    servedRevisionId: null,
    fallbackApplied: false,
    payload: null,
    canonical: null,
    cacheDependencies: { tags },
    emptyReason,
  };
}

/**
 * The single public read facade AD-5 fixed the shape of (Story 5.1).
 * Follows AD-5's seven steps in order: (1) look up the requested locale's
 * published revision; (2) if present, serve it; (3) otherwise ask
 * `resolveContentFallback` whether Turkish fallback applies; (4) if
 * permitted, look up the Turkish published revision; (5) if present, serve
 * it as fallback (`canonical` set to this entity's own published Turkish
 * route); (6) if absent, return a safe classified empty result; (7) in
 * every branch, attach a complete `CacheDependencySet` before returning.
 * An archived entity, one that does not exist, or one whose *actual*
 * stored `contentType` does not match the caller-supplied `contentType`
 * (never trusted blindly - a mismatch would otherwise let an attacker- or
 * bug-supplied label bypass that real type's rich-text sanitization
 * registration) is rejected before either locale lookup runs, per
 * AC-5.1-03. Read-only by construction: this module imports nothing from
 * `./publishing.ts`, `./admin-context.ts`, or `./admin-content-store.ts`.
 * A `PublishedContentSource` failure never propagates as a raw error - it
 * is caught and returned as a safe classified `source-error` result.
 */
export async function resolve(
  client: PrismaClient,
  input: Readonly<{ entityId: string; contentType: string; requestedLocale: ContentLocale }>,
  source?: PublishedContentSource,
): Promise<PublicProjectionResult> {
  const store = source ?? new PublishedContentStore(client);

  try {
    const state = await store.getEntityState(input.entityId);
    if (!state || state.archived || state.contentType !== input.contentType) {
      return emptyProjection(input, "no-entity", [contentEntityTag(input.entityId)]);
    }

    const native = await store.getPublishedTranslation(input.entityId, input.requestedLocale);
    const decision = resolveContentFallback(input.requestedLocale, native);

    if (decision.kind === "native" && native) {
      return {
        entityId: input.entityId,
        contentType: input.contentType,
        requestedLocale: input.requestedLocale,
        servedLocale: input.requestedLocale,
        servedRevisionId: native.publishedRevisionId,
        fallbackApplied: false,
        payload: sanitizeCanonicalPayloadForType(native.payload, input.contentType),
        canonical: null,
        cacheDependencies: {
          tags: [
            contentEntityTag(input.entityId),
            contentAvailabilityTag(input.entityId, input.requestedLocale),
            contentRevisionTag(input.entityId, input.requestedLocale, native.publishedRevisionId),
          ],
        },
        emptyReason: null,
      };
    }

    if (decision.kind === "empty") {
      return emptyProjection(input, decision.reason, [
        contentEntityTag(input.entityId),
        contentAvailabilityTag(input.entityId, input.requestedLocale),
      ]);
    }

    const turkish = await store.getPublishedTranslation(input.entityId, "tr");
    if (turkish) {
      const routes = await store.getEntityRoutes(input.entityId);
      const trRoute = routes.find((route) => route.locale === "tr") ?? null;
      return {
        entityId: input.entityId,
        contentType: input.contentType,
        requestedLocale: input.requestedLocale,
        servedLocale: "tr",
        servedRevisionId: turkish.publishedRevisionId,
        fallbackApplied: true,
        payload: sanitizeCanonicalPayloadForType(turkish.payload, input.contentType),
        canonical: trRoute ? { url: generateRoute(trRoute), noindex: true } : null,
        cacheDependencies: {
          tags: [
            contentEntityTag(input.entityId),
            contentAvailabilityTag(input.entityId, input.requestedLocale),
            contentAvailabilityTag(input.entityId, "tr"),
            contentRevisionTag(input.entityId, "tr", turkish.publishedRevisionId),
          ],
        },
        emptyReason: null,
      };
    }

    return emptyProjection(input, "no-published-any-locale", [
      contentEntityTag(input.entityId),
      contentAvailabilityTag(input.entityId, input.requestedLocale),
      contentAvailabilityTag(input.entityId, "tr"),
    ]);
  } catch {
    return emptyProjection(input, "source-error", [contentEntityTag(input.entityId)]);
  }
}
