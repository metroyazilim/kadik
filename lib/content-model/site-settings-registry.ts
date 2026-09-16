import type { PrismaClient } from "@prisma/client";
import { SITE_SETTINGS_CONTENT_TYPE, SITE_SETTINGS_SCHEMA_VERSION } from "./site-settings-schema";

/**
 * Ensures the single `ContentEntity` (`contentType = "site-settings"`), its
 * `SiteSettingsRegistry` row, and both canonical `ContentTranslation` rows
 * (tr/en, content-less until an admin saves a draft) exist - mirrors
 * `home-section-registry.ts`'s `ensureHomeSectionRegistry()` exactly, just
 * for one entity instead of eleven. Never invoked implicitly from a page
 * render; callers are `prisma/seed.ts` for real environments, this admin
 * panel's own read path (`getSiteSettingsEntityId`, idempotently, since a
 * fresh environment may not have run the seed yet), and integration tests
 * directly against `testDatabase.client`.
 */
export async function ensureSiteSettingsEntity(client: PrismaClient): Promise<Readonly<{ entityId: string }>> {
  const existing = await client.siteSettingsRegistry.findUnique({ where: { singleton: true } });
  if (existing) return { entityId: existing.entityId };

  return client.$transaction(async (tx) => {
    // Re-check inside the transaction: two concurrent bootstrap calls could
    // both pass the check above before either commits.
    const stillMissing = await tx.siteSettingsRegistry.findUnique({ where: { singleton: true } });
    if (stillMissing) return { entityId: stillMissing.entityId };

    const entity = await tx.contentEntity.create({
      data: { contentType: SITE_SETTINGS_CONTENT_TYPE, provenance: "authored" },
    });
    await tx.siteSettingsRegistry.create({
      data: { entityId: entity.id, schemaVersion: SITE_SETTINGS_SCHEMA_VERSION },
    });
    await Promise.all(
      (["tr", "en"] as const).map((locale) =>
        tx.contentTranslation.create({ data: { entityId: entity.id, locale } }),
      ),
    );
    return { entityId: entity.id };
  });
}

/** Read-only lookup for callers that already know the registry has been bootstrapped (e.g. the public reader, which never mutates). Returns `null` before the first `ensureSiteSettingsEntity()` call in a fresh environment. */
export async function getSiteSettingsEntityId(client: PrismaClient): Promise<string | null> {
  const row = await client.siteSettingsRegistry.findUnique({ where: { singleton: true } });
  return row?.entityId ?? null;
}
