import type { ContentLocale } from "@prisma/client";
import type { Db } from "./db";

/**
 * Read-facing snapshot of a `ContentTranslation` row. Never carries the
 * revision payload itself - callers that need the draft/published content
 * fetch the corresponding `ContentTranslationRevision` by id.
 */
export type TranslationSnapshot = Readonly<{
  id: string;
  entityId: string;
  locale: ContentLocale;
  draftRevisionId: string | null;
  publishedRevisionId: string | null;
  version: number;
  publishedAt: Date | null;
}>;

type TranslationRow = {
  id: string;
  entityId: string;
  locale: ContentLocale;
  draftRevisionId: string | null;
  publishedRevisionId: string | null;
  version: number;
  publishedAt: Date | null;
};

export function toTranslationSnapshot(row: TranslationRow): TranslationSnapshot {
  return {
    id: row.id,
    entityId: row.entityId,
    locale: row.locale,
    draftRevisionId: row.draftRevisionId,
    publishedRevisionId: row.publishedRevisionId,
    version: row.version,
    publishedAt: row.publishedAt,
  };
}

export type CreateEntityInput = Readonly<{
  contentType: string;
  provenance?: string;
}>;

export type EntitySnapshot = Readonly<{
  id: string;
  contentType: string;
  archived: boolean;
  version: number;
  provenance: string;
}>;

/**
 * Creates a locale-independent content entity. An entity carries no
 * locale-specific field - anything that varies by locale belongs on
 * `ContentTranslation` or its revisions (per `content-model.md`).
 */
export async function createEntity(
  client: Db,
  input: CreateEntityInput,
): Promise<EntitySnapshot> {
  const entity = await client.contentEntity.create({
    data: {
      contentType: input.contentType,
      ...(input.provenance === undefined ? {} : { provenance: input.provenance }),
    },
  });
  return {
    id: entity.id,
    contentType: entity.contentType,
    archived: entity.archived,
    version: entity.version,
    provenance: entity.provenance,
  };
}

export type CreateTranslationInput = Readonly<{
  entityId: string;
  locale: ContentLocale;
}>;

/**
 * Creates the one `(entityId, locale)` translation row. Its own id is stable
 * across every later draft save for this locale - only `draftRevisionId`,
 * `publishedRevisionId`, `version`, `publishedAt`, and `updatedAt` ever
 * change.
 */
export async function createTranslation(
  client: Db,
  input: CreateTranslationInput,
): Promise<TranslationSnapshot> {
  const translation = await client.contentTranslation.create({
    data: {
      entityId: input.entityId,
      locale: input.locale,
    },
  });
  return toTranslationSnapshot(translation);
}
