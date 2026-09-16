import type { PrismaClient } from "@prisma/client";
import type { ContentPageKey } from "@prisma/client";
export type { ContentPageKey };

/**
 * The closed set of admin-managed static content pages (Spec 3). Mirrors
 * `home-section-registry.ts`'s `HOME_SECTION_KEYS` shape: this array is the
 * single source of truth the Prisma `ContentPageKey` enum, the admin
 * "Sayfalar" list, and every `isContentPageKey`/`contentPageContentType`
 * caller all agree with. Starts with `about` only; a future page adds a
 * value here and its own payload validator, never a second registry shape.
 */
export const CONTENT_PAGE_KEYS = ["about"] as const satisfies readonly ContentPageKey[];

/** The subset of `ContentPageKey` that owns a locale-aware content payload
 * (and therefore a payload validator). The Prisma enum is wider because a
 * page can render fixed, code-owned components without owning any
 * locale-aware payload of its own. */
export type ContentPagePayloadKey = (typeof CONTENT_PAGE_KEYS)[number];

const CONTENT_PAGE_KEY_LOOKUP: Readonly<Record<string, true>> = Object.fromEntries(
  CONTENT_PAGE_KEYS.map((key) => [key, true as const]),
);

export function isContentPageKey(value: unknown): value is ContentPagePayloadKey {
  return typeof value === "string" && CONTENT_PAGE_KEY_LOOKUP[value] === true;
}

/** Turkish display labels for the admin "Sayfalar" list. */
export const CONTENT_PAGE_LABELS: Readonly<Record<ContentPagePayloadKey, string>> = {
  about: "Hakkımızda",
};

const CONTENT_PAGE_CONTENT_TYPE_PREFIX = "content-page:";

/**
 * Encodes a content page's registry key into the `contentType` its backing
 * `ContentEntity` carries - mirrors `homeSectionContentType()` exactly, so
 * `saveDraft`/`publish`/`resolve()`/`payload-validation.ts`'s `validatePayload`
 * dispatch all work on a content-page entity completely unmodified.
 */
export function contentPageContentType(key: ContentPageKey): string {
  return `${CONTENT_PAGE_CONTENT_TYPE_PREFIX}${key}`;
}

/** Inverse of `contentPageContentType`. Returns `null` for any content type that is not one of this registry's own. */
export function contentPageKeyFromContentType(contentType: string): ContentPagePayloadKey | null {
  if (!contentType.startsWith(CONTENT_PAGE_CONTENT_TYPE_PREFIX)) return null;
  const candidate = contentType.slice(CONTENT_PAGE_CONTENT_TYPE_PREFIX.length);
  return isContentPageKey(candidate) ? candidate : null;
}

/**
 * Idempotent bootstrap (mirrors `ensureSiteSettingsEntity()` exactly, keyed
 * instead of singleton): ensures the `ContentPageRegistry` row for `key`,
 * its backing `ContentEntity` (`contentType = content-page:<key>`), and both
 * canonical `ContentTranslation` rows (tr/en, content-less until a draft is
 * saved) exist. Safe to call repeatedly and safe to race - a second
 * concurrent bootstrap for the same key re-checks inside the transaction
 * and returns the winner's row rather than creating a duplicate.
 */
export async function ensureContentPageEntity(
  client: PrismaClient,
  key: ContentPagePayloadKey,
): Promise<Readonly<{ entityId: string }>> {
  const existing = await client.contentPageRegistry.findUnique({ where: { key } });
  if (existing) return { entityId: existing.entityId };

  return client.$transaction(async (tx) => {
    const stillMissing = await tx.contentPageRegistry.findUnique({ where: { key } });
    if (stillMissing) return { entityId: stillMissing.entityId };

    const entity = await tx.contentEntity.create({
      data: { contentType: contentPageContentType(key), provenance: "authored" },
    });
    await tx.contentPageRegistry.create({
      data: { key, entityId: entity.id, schemaVersion: CONTENT_PAGE_SCHEMA_VERSIONS[key] },
    });
    await Promise.all(
      (["tr", "en"] as const).map((locale) =>
        tx.contentTranslation.create({ data: { entityId: entity.id, locale } }),
      ),
    );
    return { entityId: entity.id };
  });
}

/** Read-only lookup for callers that already know the registry has been bootstrapped (e.g. the public reader, which never mutates). Returns `null` before the first `ensureContentPageEntity()` call for that key in a fresh environment. */
export async function getContentPageEntityId(
  client: PrismaClient,
  key: ContentPagePayloadKey,
): Promise<string | null> {
  const row = await client.contentPageRegistry.findUnique({ where: { key } });
  return row?.entityId ?? null;
}

/**
 * Each key's current payload schema version, recorded on its
 * `ContentPageRegistry` row at bootstrap time - mirrors
 * `SITE_SETTINGS_SCHEMA_VERSION`'s single-constant shape, just keyed since
 * this registry has more than one entity. Bumped only alongside a breaking
 * change to that key's validator in `payload-validation.ts`.
 */
export const CONTENT_PAGE_SCHEMA_VERSIONS: Readonly<Record<ContentPagePayloadKey, number>> = {
  about: 1,
};

