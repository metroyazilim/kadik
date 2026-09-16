import type { PrismaClient, HomeSectionKey } from "@prisma/client";
import { ContentModelError } from "./errors";
import { withTransaction, type MaybeTransactionClient } from "./publishing";
import {
  HOME_LAYOUT_SCHEMA_VERSION,
  defaultHomeLayoutPayload,
  validateHomeLayoutPayload,
  type HomeLayoutSectionEntry,
} from "./home-section-registry";

/**
 * Internal-only signal used to abort the surrounding `$transaction` when
 * the database-level compare-and-swap (`updateMany` matched on `id AND
 * version`) affects zero rows. Mirrors `publishing.ts`'s
 * `ConcurrencyConflict` exactly, for the same reason: aborting rolls back
 * everything the transaction did up to that point, including an inserted
 * revision, so a lost race never leaves an orphaned revision behind.
 */
class HomeLayoutConcurrencyConflict extends Error {}

export type HomeLayoutSnapshot = Readonly<{
  id: string;
  version: number;
  draftRevisionId: string | null;
  publishedRevisionId: string | null;
  publishedAt: Date | null;
}>;

function toHomeLayoutSnapshot(row: {
  id: string;
  version: number;
  draftRevisionId: string | null;
  publishedRevisionId: string | null;
  publishedAt: Date | null;
}): HomeLayoutSnapshot {
  return {
    id: row.id,
    version: row.version,
    draftRevisionId: row.draftRevisionId,
    publishedRevisionId: row.publishedRevisionId,
    publishedAt: row.publishedAt,
  };
}

/**
 * Reads the singleton `HomeLayout` row and the payload an admin is
 * currently working from: the draft revision's payload if a draft exists,
 * else the published revision's payload, else `defaultHomeLayoutPayload()`
 * when the layout row itself does not exist yet (only possible before
 * `ensureHomeSectionRegistry()` has ever run).
 */
export async function getHomeLayoutWorkingState(client: PrismaClient): Promise<
  Readonly<{ layout: HomeLayoutSnapshot | null; payload: readonly HomeLayoutSectionEntry[] }>
> {
  const layout = await client.homeLayout.findUnique({
    where: { singleton: true },
    include: { draftRevision: true, publishedRevision: true },
  });
  if (!layout) {
    return { layout: null, payload: defaultHomeLayoutPayload() };
  }
  const sourceRevision = layout.draftRevision ?? layout.publishedRevision;
  const payload = sourceRevision
    ? validateHomeLayoutPayload(sourceRevision.schemaVersion, sourceRevision.payload)
    : defaultHomeLayoutPayload();
  return { layout: toHomeLayoutSnapshot(layout), payload };
}

export type HomeLayoutSaveInput = Readonly<{
  expectedVersion: number;
  schemaVersion: number;
  payload: readonly HomeLayoutSectionEntry[];
  createdBy: string;
  changeKind: "reorder" | "visibility";
}>;

export type HomeLayoutSaveResult =
  | Readonly<{ ok: true; layout: HomeLayoutSnapshot; revisionId: string }>
  | Readonly<{ ok: false; conflict: true; current: HomeLayoutSnapshot }>;

/**
 * Low-level CAS-guarded draft save (CAP-2). Structurally mirrors
 * `publishing.ts`'s `saveDraft` (insert immutable revision, repoint
 * `draftRevisionId`, compare-and-swap on `expectedVersion`), operating on
 * `homeLayout`/`homeLayoutRevision` instead of `contentTranslation`.
 * Audit is written inline, inside the same transaction, rather than through
 * an injected `AuditRecorder` callback (Home's audit shape is fixed and
 * known - see `home-layout-model.md`).
 *
 * If no `HomeLayout` row exists yet, creates it first (inside the same
 * transaction, `expectedVersion` for a not-yet-existing layout must be
 * `0`) - this only happens if `ensureHomeSectionRegistry()` has not run,
 * which application code (Story 2.1's admin store) never allows in
 * practice, but this function stays correct even so.
 */
export async function saveHomeLayoutDraft(
  client: PrismaClient,
  input: HomeLayoutSaveInput,
): Promise<HomeLayoutSaveResult> {
  const canonicalPayload = validateHomeLayoutPayload(input.schemaVersion, input.payload);

  try {
    return await client.$transaction(async (tx) => {
      let layout = await tx.homeLayout.findUnique({ where: { singleton: true } });
      if (!layout) {
        if (input.expectedVersion !== 0) throw new HomeLayoutConcurrencyConflict();
        layout = await tx.homeLayout.create({ data: {} });
      } else if (layout.version !== input.expectedVersion) {
        throw new HomeLayoutConcurrencyConflict();
      }

      const revision = await tx.homeLayoutRevision.create({
        data: {
          layoutId: layout.id,
          schemaVersion: input.schemaVersion,
          payload: canonicalPayload,
          createdBy: input.createdBy,
        },
      });

      const updated = await tx.homeLayout.updateMany({
        where: { id: layout.id, version: input.expectedVersion },
        data: { draftRevisionId: revision.id, version: { increment: 1 } },
      });
      if (updated.count === 0) throw new HomeLayoutConcurrencyConflict();

      const updatedLayout = await tx.homeLayout.findUniqueOrThrow({ where: { id: layout.id } });

      await tx.auditLog.create({
        data: {
          action: "home.layout.draft.save",
          entity: "HomeLayout",
          entityId: updatedLayout.id,
          userId: input.createdBy,
          metadata: {
            changeKind: input.changeKind,
            priorDraftRevisionId: layout.draftRevisionId,
            nextDraftRevisionId: revision.id,
            priorPublishedRevisionId: layout.publishedRevisionId,
            nextPublishedRevisionId: updatedLayout.publishedRevisionId,
            version: updatedLayout.version,
          },
        },
      });

      return {
        ok: true as const,
        layout: toHomeLayoutSnapshot(updatedLayout),
        revisionId: revision.id,
      };
    });
  } catch (error) {
    if (error instanceof HomeLayoutConcurrencyConflict) {
      const current = await client.homeLayout.findUnique({ where: { singleton: true } });
      if (!current) {
        throw new ContentModelError(
          "internal",
          "The Home layout could not be reloaded after a conflict.",
        );
      }
      return { ok: false as const, conflict: true as const, current: toHomeLayoutSnapshot(current) };
    }
    if (error instanceof ContentModelError) throw error;
    throw new ContentModelError("internal", "The Home layout draft save failed unexpectedly.", {
      cause: error,
    });
  }
}

/**
 * Pure payload transform (CAP-3 / AC-2.1-02/03): reorders `current` to
 * `orderedKeys` while leaving every section's `enabled` flag byte-identical.
 * Exported standalone so its "reorder never touches visibility" guarantee
 * is unit-testable without a database. Throws `ContentModelError` if
 * `orderedKeys` is not exactly a permutation of `current`'s keys - it is
 * not this function's job to silently drop or invent a section.
 */
export function reorderedPayload(
  current: readonly HomeLayoutSectionEntry[],
  orderedKeys: readonly HomeSectionKey[],
): HomeLayoutSectionEntry[] {
  const enabledByKey = new Map(current.map((entry) => [entry.key, entry.enabled]));
  if (orderedKeys.length !== current.length || enabledByKey.size !== orderedKeys.length) {
    throw new ContentModelError("invalidInput", "The reorder list must contain every registry section exactly once.");
  }
  return orderedKeys.map((key) => {
    const enabled = enabledByKey.get(key);
    if (enabled === undefined) {
      throw new ContentModelError("invalidInput", "The reorder list references a section outside the registry.");
    }
    return { key, enabled };
  });
}

/**
 * Pure payload transform (CAP-3 / AC-2.1-03): flips exactly one section's
 * `enabled` flag, leaving every section's position and every other
 * section's `enabled` value byte-identical. Exported standalone for the
 * same unit-testability reason as `reorderedPayload`.
 */
export function visibilityTogglePayload(
  current: readonly HomeLayoutSectionEntry[],
  key: HomeSectionKey,
  enabled: boolean,
): HomeLayoutSectionEntry[] {
  if (!current.some((entry) => entry.key === key)) {
    throw new ContentModelError("invalidInput", "The section is not defined in the registry.");
  }
  return current.map((entry) => (entry.key === key ? { key: entry.key, enabled } : entry));
}

/**
 * Reorders the working payload (draft, else published, else default) to
 * `orderedKeys` via `reorderedPayload`, then saves it as a new draft.
 */
export async function reorderHomeSections(
  client: PrismaClient,
  input: Readonly<{ expectedVersion: number; orderedKeys: readonly HomeSectionKey[]; createdBy: string }>,
): Promise<HomeLayoutSaveResult> {
  const { payload: current } = await getHomeLayoutWorkingState(client);
  const nextPayload = reorderedPayload(current, input.orderedKeys);
  return saveHomeLayoutDraft(client, {
    expectedVersion: input.expectedVersion,
    schemaVersion: HOME_LAYOUT_SCHEMA_VERSION,
    payload: nextPayload,
    createdBy: input.createdBy,
    changeKind: "reorder",
  });
}

/**
 * Flips one section's `enabled` flag in the working payload via
 * `visibilityTogglePayload`, then saves it as a new draft.
 */
export async function setHomeSectionVisibility(
  client: PrismaClient,
  input: Readonly<{ expectedVersion: number; key: HomeSectionKey; enabled: boolean; createdBy: string }>,
): Promise<HomeLayoutSaveResult> {
  const { payload: current } = await getHomeLayoutWorkingState(client);
  const nextPayload = visibilityTogglePayload(current, input.key, input.enabled);
  return saveHomeLayoutDraft(client, {
    expectedVersion: input.expectedVersion,
    schemaVersion: HOME_LAYOUT_SCHEMA_VERSION,
    payload: nextPayload,
    createdBy: input.createdBy,
    changeKind: "visibility",
  });
}

export type HomeLayoutPublishInput = Readonly<{
  expectedVersion: number;
  expectedDraftRevisionId: string;
  publishedBy: string;
}>;

export type HomeLayoutPublishResult =
  | Readonly<{ ok: true; layout: HomeLayoutSnapshot }>
  | Readonly<{ ok: false; conflict: true; current: HomeLayoutSnapshot }>;

/**
 * Publish transaction boundary for the Home layout, mirroring
 * `publishing.ts`'s `publish()`: expected-version + expected-draft-pointer
 * check -> draft-revision ownership/payload re-validation -> pointer swap
 * (`publishedRevisionId`) -> `publishedAt`/`version` bump -> audit write ->
 * invalidation-outbox write, all inside one transaction. A stale
 * `expectedVersion`/`expectedDraftRevisionId` or a lost race against a
 * concurrent publish returns the same safe conflict; nothing is mutated.
 *
 * The outbox event is written directly (`tx.invalidationOutboxEvent.create`)
 * with `sourceTranslationId: null` and `locale: null` - the layout is not
 * translation-scoped, and `InvalidationOutboxEvent`'s schema already allows
 * both columns to be null for exactly this kind of domain-level event
 * (Story 0.5). `sourceEntityId` carries the singleton `HomeLayout.id`
 * (that column has no foreign-key constraint, so this is a safe reuse, not
 * a schema violation). `tags: ["home:layout"]` is the cache-dependency tag
 * Story 2.3/2.5's readers key their invalidation off.
 */
export async function publishHomeLayout(
  client: MaybeTransactionClient,
  input: HomeLayoutPublishInput,
): Promise<HomeLayoutPublishResult> {
  try {
    return await withTransaction(client, async (tx) => {
      const current = await tx.homeLayout.findUnique({ where: { singleton: true } });
      if (!current) {
        throw new ContentModelError("invalidInput", "The Home layout does not exist yet.");
      }
      if (
        current.version !== input.expectedVersion ||
        current.draftRevisionId !== input.expectedDraftRevisionId
      ) {
        throw new HomeLayoutConcurrencyConflict();
      }

      const draftRevision = await tx.homeLayoutRevision.findUnique({
        where: { id: input.expectedDraftRevisionId },
      });
      if (!draftRevision || draftRevision.layoutId !== current.id) {
        throw new HomeLayoutConcurrencyConflict();
      }
      // Full re-validation of the candidate draft revision's payload,
      // mirroring publishing.ts's publish() re-validating the candidate
      // draft before it can become published.
      validateHomeLayoutPayload(draftRevision.schemaVersion, draftRevision.payload);

      const updated = await tx.homeLayout.updateMany({
        where: {
          id: current.id,
          version: input.expectedVersion,
          draftRevisionId: input.expectedDraftRevisionId,
        },
        data: {
          publishedRevisionId: input.expectedDraftRevisionId,
          version: { increment: 1 },
          publishedAt: current.publishedAt ?? new Date(),
        },
      });
      if (updated.count === 0) throw new HomeLayoutConcurrencyConflict();

      const updatedLayout = await tx.homeLayout.findUniqueOrThrow({ where: { id: current.id } });

      await tx.auditLog.create({
        data: {
          action: "home.layout.publish",
          entity: "HomeLayout",
          entityId: updatedLayout.id,
          userId: input.publishedBy,
          metadata: {
            priorPublishedRevisionId: current.publishedRevisionId,
            nextPublishedRevisionId: updatedLayout.publishedRevisionId,
            version: updatedLayout.version,
          },
        },
      });

      await tx.invalidationOutboxEvent.create({
        data: {
          sourceEntityId: updatedLayout.id,
          sourceTranslationId: null,
          locale: null,
          tags: ["home:layout"],
        },
      });

      return { ok: true as const, layout: toHomeLayoutSnapshot(updatedLayout) };
    });
  } catch (error) {
    if (error instanceof HomeLayoutConcurrencyConflict) {
      const current = await client.homeLayout.findUnique({ where: { singleton: true } });
      if (!current) {
        throw new ContentModelError(
          "internal",
          "The Home layout could not be reloaded after a conflict.",
        );
      }
      return { ok: false as const, conflict: true as const, current: toHomeLayoutSnapshot(current) };
    }
    if (error instanceof ContentModelError) throw error;
    throw new ContentModelError("internal", "The Home layout publish failed unexpectedly.", {
      cause: error,
    });
  }
}
