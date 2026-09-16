import { Prisma } from "@prisma/client";
import { withTransaction, type Db } from "./db";
import { ContentModelError } from "./errors";
import { toTranslationSnapshot, type TranslationSnapshot } from "./model";
import { validatePayload } from "./payload-validation";
import type { AuditRecorder } from "./audit-recorder";
import type { OutboxRegistrar } from "./outbox-recorder";
import {
  generateRoute,
  normalizeRouteSegment,
  type RouteCandidate,
  type RouteRegistrar,
} from "./route-registry";
export { withTransaction, type Db } from "./db";

/**
 * Internal-only signal used to abort the surrounding `$transaction` when the
 * database-level compare-and-swap (the conditional `updateMany` matched on
 * `id AND version`) affects zero rows. Aborting rolls back everything the
 * transaction did up to that point - including an inserted draft revision -
 * so a lost race never leaves an orphaned revision behind.
 */
class ConcurrencyConflict extends Error {}

/**
 * Internal-only signal used to abort the transaction when publish()'s
 * route-reservation hook (Story 0.4) finds that a *different* translation
 * already owns the normalized `(contentType, locale, collectionSegment,
 * slug)` combination. Same abort mechanism as `ConcurrencyConflict` -
 * caught by the surrounding `catch`, returned as a safe `routeConflict`
 * result, never reaching the pointer-swap `updateMany`.
 */
class RouteReservationConflict extends Error {}

/**
 * Backward-compatible alias: `MaybeTransactionClient` is `Db` (the
 * `PrismaClient | Prisma.TransactionClient` union defined in `./db`,
 * added by the Story 3.1 atomic-transaction correction). `withTransaction`
 * itself is re-exported from `./db` above rather than redefined here, so
 * every caller of either name shares the same single implementation.
 */
export type MaybeTransactionClient = Db;

export type SaveDraftInput = Readonly<{
  translationId: string;
  expectedVersion: number;
  schemaVersion: number;
  payload: Prisma.InputJsonValue;
  createdBy: string;
}>;

export type SaveDraftResult =
  | Readonly<{
      ok: true;
      translation: TranslationSnapshot;
      revisionId: string;
    }>
  | Readonly<{
      ok: false;
      conflict: true;
      current: TranslationSnapshot;
      submitted: Readonly<{ schemaVersion: number; payload: Prisma.InputJsonValue }>;
    }>;

/**
 * Inserts a new immutable revision and repoints `draftRevisionId` at it,
 * guarded by an optimistic-concurrency compare-and-swap on `expectedVersion`.
 * The version match is checked *before* payload validation: a stale
 * `expectedVersion` always returns a safe conflict, even if the submitted
 * payload is itself invalid - per `content-model.md`'s concurrency contract,
 * staleness takes precedence over validation. A stale version discovered
 * only when a concurrent save wins the race is caught by the same
 * database-level CAS. Either way the caller's submitted payload is echoed
 * back unmodified; no revision is left behind and no pointer changes.
 */
export async function saveDraft(
  client: Db,
  input: SaveDraftInput,
  audit?: AuditRecorder,
): Promise<SaveDraftResult> {
  try {
    return await withTransaction(client, async (tx) => {
      const translation = await tx.contentTranslation.findUnique({
        where: { id: input.translationId },
        include: { entity: { select: { contentType: true } } },
      });
      if (!translation) {
        throw new ContentModelError("invalidInput", "The translation does not exist.");
      }
      if (translation.version !== input.expectedVersion) {
        throw new ConcurrencyConflict();
      }

      const canonicalPayload = validatePayload(
        translation.entity.contentType,
        input.schemaVersion,
        input.payload,
      );

      const revision = await tx.contentTranslationRevision.create({
        data: {
          translationId: input.translationId,
          schemaVersion: input.schemaVersion,
          payload: canonicalPayload as unknown as Prisma.InputJsonValue,
          createdBy: input.createdBy,
        },
      });

      const updated = await tx.contentTranslation.updateMany({
        where: { id: input.translationId, version: input.expectedVersion },
        data: { draftRevisionId: revision.id, version: { increment: 1 } },
      });
      if (updated.count === 0) throw new ConcurrencyConflict();

      const updatedTranslation = await tx.contentTranslation.findUniqueOrThrow({
        where: { id: input.translationId },
      });

      // Seam (Story 0.3): audit-record write, inside this same transaction.
      // A throw here rolls back the revision insert and pointer move above.
      if (audit) {
        await audit(tx, {
          action: "content.draft.save",
          entity: "ContentTranslation",
          entityId: input.translationId,
          metadata: {
            locale: updatedTranslation.locale,
            priorDraftRevisionId: translation.draftRevisionId,
            nextDraftRevisionId: revision.id,
            priorPublishedRevisionId: translation.publishedRevisionId,
            nextPublishedRevisionId: updatedTranslation.publishedRevisionId,
            version: updatedTranslation.version,
          },
        });
      }

      return {
        ok: true as const,
        translation: toTranslationSnapshot(updatedTranslation),
        revisionId: revision.id,
      };
    });
  } catch (error) {
    if (error instanceof ConcurrencyConflict) {
      let current;
      try {
        current = await client.contentTranslation.findUniqueOrThrow({
          where: { id: input.translationId },
        });
      } catch (reloadError) {
        throw new ContentModelError(
          "internal",
          "The translation could not be reloaded after a conflict.",
          { cause: reloadError },
        );
      }
      return {
        ok: false as const,
        conflict: true as const,
        current: toTranslationSnapshot(current),
        submitted: { schemaVersion: input.schemaVersion, payload: input.payload },
      };
    }
    if (error instanceof ContentModelError) throw error;
    throw new ContentModelError("internal", "The draft save failed unexpectedly.", {
      cause: error,
    });
  }
}

export type PublishInput = Readonly<{
  translationId: string;
  expectedVersion: number;
  expectedDraftRevisionId: string;
}>;

export type PublishResult =
  | Readonly<{
      ok: true;
      translation: TranslationSnapshot;
      route?: Readonly<{ url: string }>;
    }>
  | Readonly<{
      ok: false;
      conflict: true;
      current: TranslationSnapshot;
      submitted: Readonly<{ expectedVersion: number; expectedDraftRevisionId: string }>;
    }>
  | Readonly<{
      ok: false;
      routeConflict: true;
      submittedRoute: RouteCandidate;
    }>;

/**
 * Publish transaction boundary (per AD-3 / `content-model.md`):
 *
 *   authorization check (seam reserved for Story 0.3)
 *   -> expected-version + expected-draft-pointer check
 *   -> candidate draft revision ownership check (belongs to this translation)
 *   -> full payload validation of the candidate draft revision
 *   -> route-candidate normalization + collision check (Story 0.4, seam
 *      reserved by Story 0.2/0.3 - runs before the pointer swap so a
 *      colliding or unsafe route never reaches published state)
 *   -> pointer update (`publishedRevisionId`)
 *   -> `publishedAt` / `version` bump
 *   -> audit write (Story 0.3), `ContentRoute` upsert (Story 0.4), and
 *      `InvalidationOutboxEvent` write (Story 0.5) - all three, when
 *      present, inside this same transaction, in that order
 *
 * Never creates a revision - it only repoints `publishedRevisionId` at an
 * already-saved draft revision. A stale `expectedVersion` or
 * `expectedDraftRevisionId`, a draft revision that does not belong to this
 * translation, or a race lost against a concurrent publish - all return the
 * same safe conflict result; pointers and version are left untouched.
 */
export async function publish(
  client: Db,
  input: PublishInput,
  audit?: AuditRecorder,
  route?: RouteRegistrar,
  outbox?: OutboxRegistrar,
): Promise<PublishResult> {
  try {
    return await withTransaction(client, async (tx) => {
      // Seam: actor-context authorization check attaches here (Story 0.3's contract).
      const current = await tx.contentTranslation.findUnique({
        where: { id: input.translationId },
      });
      if (!current) {
        throw new ContentModelError("invalidInput", "The translation does not exist.");
      }
      if (
        current.version !== input.expectedVersion ||
        current.draftRevisionId !== input.expectedDraftRevisionId
      ) {
        throw new ConcurrencyConflict();
      }

      const draftRevision = await tx.contentTranslationRevision.findUnique({
        where: { id: input.expectedDraftRevisionId },
        include: { translation: { include: { entity: { select: { contentType: true } } } } },
      });
      // The pointer foreign key only constrains "a valid revision id", not
      // "a revision owned by this translation" - that ownership invariant is
      // enforced here explicitly rather than trusted from the FK alone.
      if (!draftRevision || draftRevision.translationId !== input.translationId) {
        throw new ConcurrencyConflict();
      }
      validatePayload(
        draftRevision.translation.entity.contentType,
        draftRevision.schemaVersion,
        draftRevision.payload,
      );

      // Seam (Story 0.4): route normalization + collision reservation, run
      // before the pointer swap below. `normalizeRouteSegment` throwing
      // (unsafe Unicode / structural separator / double-encoding) aborts
      // here with no query yet run against this translation's pointer -
      // nothing to roll back beyond what Postgres already discards.
      let normalizedRoute: RouteCandidate | undefined;
      if (route) {
        // A submitted candidate whose locale/contentType does not match the
        // translation actually being published would otherwise let this
        // transaction write a ContentRoute row that lies about which
        // translation backs it - reject before normalizing or checking
        // collision, not merely trusted from the caller.
        if (
          route.candidate.locale !== draftRevision.translation.locale ||
          route.candidate.contentType !== draftRevision.translation.entity.contentType
        ) {
          throw new ContentModelError(
            "invalidInput",
            "The route candidate's locale/contentType does not match the translation being published.",
          );
        }
        normalizedRoute = {
          contentType: route.candidate.contentType,
          locale: route.candidate.locale,
          collectionSegment: normalizeRouteSegment(
            route.candidate.locale,
            "collectionSegment",
            route.candidate.collectionSegment,
          ),
          slug: normalizeRouteSegment(route.candidate.locale, "slug", route.candidate.slug),
        };
        const colliding = await tx.contentRoute.findFirst({
          where: {
            contentType: normalizedRoute.contentType,
            locale: normalizedRoute.locale,
            collectionSegment: normalizedRoute.collectionSegment,
            slug: normalizedRoute.slug,
            NOT: { translationId: input.translationId },
          },
        });
        if (colliding) {
          throw new RouteReservationConflict();
        }
      }

      const updated = await tx.contentTranslation.updateMany({
        where: {
          id: input.translationId,
          version: input.expectedVersion,
          draftRevisionId: input.expectedDraftRevisionId,
        },
        data: {
          publishedRevisionId: input.expectedDraftRevisionId,
          version: { increment: 1 },
          publishedAt: current.publishedAt ?? new Date(),
        },
      });
      if (updated.count === 0) throw new ConcurrencyConflict();

      const updatedTranslation = await tx.contentTranslation.findUniqueOrThrow({
        where: { id: input.translationId },
      });

      // Seam (Story 0.3): audit-record write, inside this same transaction.
      // A throw here rolls back the pointer swap above.
      if (audit) {
        await audit(tx, {
          action: "content.publish",
          entity: "ContentTranslation",
          entityId: input.translationId,
          metadata: {
            locale: updatedTranslation.locale,
            priorDraftRevisionId: current.draftRevisionId,
            nextDraftRevisionId: updatedTranslation.draftRevisionId,
            priorPublishedRevisionId: current.publishedRevisionId,
            nextPublishedRevisionId: updatedTranslation.publishedRevisionId,
            version: updatedTranslation.version,
          },
        });
      }

      // Seam (Story 0.4): ContentRoute upsert, inside this same
      // transaction, only after the pointer swap (and audit write, if any)
      // above have succeeded - a route can never exist for content that
      // isn't actually published.
      let publishedRoute: Readonly<{ url: string }> | undefined;
      if (normalizedRoute) {
        // The pre-check above (`findFirst` excluding this translation) is a
        // TOCTOU race, not a guarantee: two concurrent publishers can both
        // observe no collision before either commits. The unique index on
        // `(contentType, locale, collectionSegment, slug)` is the real
        // guard; catch its violation here and map it to the same safe
        // `routeConflict` result rather than letting a raw Prisma error
        // (with constraint/column metadata) escape this function.
        try {
          await tx.contentRoute.upsert({
            where: { translationId: input.translationId },
            create: {
              entityId: draftRevision.translation.entityId,
              translationId: input.translationId,
              locale: normalizedRoute.locale,
              contentType: normalizedRoute.contentType,
              collectionSegment: normalizedRoute.collectionSegment,
              slug: normalizedRoute.slug,
            },
            update: {
              collectionSegment: normalizedRoute.collectionSegment,
              slug: normalizedRoute.slug,
            },
          });
        } catch (upsertError) {
          if (
            upsertError instanceof Prisma.PrismaClientKnownRequestError &&
            upsertError.code === "P2002"
          ) {
            throw new RouteReservationConflict();
          }
          throw upsertError;
        }
        publishedRoute = { url: generateRoute(normalizedRoute) };
      }

      // Seam (Story 0.5): InvalidationOutboxEvent write, inside this same
      // transaction, only after the pointer swap (and audit/route writes,
      // if any) above have succeeded - a throw here rolls back the whole
      // publish, per AC-0.5-01.
      if (outbox) {
        await outbox.recorder(tx, {
          sourceEntityId: draftRevision.translation.entityId,
          sourceTranslationId: input.translationId,
          locale: draftRevision.translation.locale,
          tags: outbox.tags,
        });
      }

      return {
        ok: true as const,
        translation: toTranslationSnapshot(updatedTranslation),
        route: publishedRoute,
      };
    });
  } catch (error) {
    if (error instanceof RouteReservationConflict) {
      if (!route) {
        throw new ContentModelError(
          "internal",
          "A route conflict was raised without a submitted route candidate.",
        );
      }
      return {
        ok: false as const,
        routeConflict: true as const,
        submittedRoute: route.candidate,
      };
    }
    if (error instanceof ConcurrencyConflict) {
      let current;
      try {
        current = await client.contentTranslation.findUniqueOrThrow({
          where: { id: input.translationId },
        });
      } catch (reloadError) {
        throw new ContentModelError(
          "internal",
          "The translation could not be reloaded after a conflict.",
          { cause: reloadError },
        );
      }
      return {
        ok: false as const,
        conflict: true as const,
        current: toTranslationSnapshot(current),
        submitted: {
          expectedVersion: input.expectedVersion,
          expectedDraftRevisionId: input.expectedDraftRevisionId,
        },
      };
    }
    if (error instanceof ContentModelError) throw error;
    throw new ContentModelError("internal", "The publish failed unexpectedly.", {
      cause: error,
    });
  }
}
