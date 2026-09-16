import "server-only";

import type { ContentLocale, HomeSectionKey, PrismaClient } from "@prisma/client";
import type { Dictionary } from "@/lib/i18n/types";
import type { MediaAssetPreview } from "./content-media";
import { resolveMediaAssetPreviews } from "./content-media";
import { getHomeLayoutWorkingState } from "./home-layout";
import {
  ensureHomeSectionRegistry,
  HOME_SECTION_KEYS,
  HOME_SECTION_LABELS,
} from "./home-section-registry";
import {
  defaultHomeSectionPayload,
  homeSectionMediaAssetIds,
  validateHomeSectionPayload,
  type HomeSectionBlocksPayload,
} from "./home-section-schemas";

const LOCALES = ["tr", "en"] as const satisfies readonly ContentLocale[];

export type FixedHomeSectionData = Readonly<{
  key: HomeSectionKey;
  /** Backing `ContentEntity` - the translation assistant exports and imports
   * against it, exactly like a collection record. */
  entityId: string;
  label: string;
  /** Layout visibility - a disabled section is skipped by the composer. */
  enabled: boolean;
  localePayloads: Readonly<Record<ContentLocale, HomeSectionBlocksPayload>>;
  localeStatuses: Readonly<Record<ContentLocale, "published" | "draft" | "missing">>;
}>;

export type FixedHomeAdminView = Readonly<{
  sections: readonly FixedHomeSectionData[];
  mediaAssetsById: Readonly<Record<string, MediaAssetPreview>>;
}>;

function statusOf(translation: {
  draftRevisionId: string | null;
  publishedRevisionId: string | null;
} | undefined): "published" | "draft" | "missing" {
  if (translation?.publishedRevisionId) return "published";
  if (translation?.draftRevisionId) return "draft";
  return "missing";
}

export async function loadFixedHomeAdminView(
  client: PrismaClient,
  dictionaries: Readonly<Record<ContentLocale, Dictionary>>,
): Promise<FixedHomeAdminView> {
  await ensureHomeSectionRegistry(client);
  const rows = await client.homeSection.findMany({
    include: {
      entity: {
        include: {
          translations: {
            include: { draftRevision: true, publishedRevision: true },
          },
        },
      },
    },
  });
  const byKey = new Map(rows.map((row) => [row.key, row]));
  const referencedAssetIds = new Set<string>();

  const { payload: layoutOrder } = await getHomeLayoutWorkingState(client);
  const orderedKeys = layoutOrder.length > 0 ? layoutOrder.map((entry) => entry.key) : HOME_SECTION_KEYS;

  const sections = orderedKeys.flatMap((key) => {
    const row = byKey.get(key);
    if (!row) return [];
    const translations = new Map(row.entity.translations.map((translation) => [translation.locale, translation]));
    const localePayloads = Object.fromEntries(
      LOCALES.map((locale) => {
        const translation = translations.get(locale);
        const revision = translation?.draftRevision ?? translation?.publishedRevision;
        let payload = defaultHomeSectionPayload(key) as HomeSectionBlocksPayload;
        if (revision) {
          try {
            payload = validateHomeSectionPayload(key, revision.schemaVersion, revision.payload);
          } catch {
            payload = defaultHomeSectionPayload(key) as HomeSectionBlocksPayload;
          }
        }
        const resolved: HomeSectionBlocksPayload = {
          blocks: payload.blocks,
          // Mirrors the public renderer exactly: an empty field stays empty
          // in the editor, so what the admin sees is what the site shows.
          widget: payload.widget ?? {},
        };
        for (const assetId of homeSectionMediaAssetIds(resolved)) referencedAssetIds.add(assetId);
        return [locale, resolved];
      }),
    ) as unknown as FixedHomeSectionData["localePayloads"];
    const localeStatuses = Object.fromEntries(
      LOCALES.map((locale) => [locale, statusOf(translations.get(locale))]),
    ) as FixedHomeSectionData["localeStatuses"];

    return [
      {
        key,
        entityId: row.entityId,
        label: HOME_SECTION_LABELS[key],
        enabled: layoutOrder.find((entry) => entry.key === key)?.enabled ?? true,
        localePayloads,
        localeStatuses,
      },
    ];
  });

  const mediaAssetsById = await resolveMediaAssetPreviews(client, [...referencedAssetIds]);
  return { sections, mediaAssetsById };
}
