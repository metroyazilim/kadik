import type { ContentLocale, HomeSectionKey, PrismaClient } from "@prisma/client";
import { getPublished } from "./public-content-reader";
import { resolveHomeProjection } from "./home-projection";
import {
  HOME_SECTION_KEYS,
  homeSectionContentType,
  defaultHomeLayoutPayload,
  validateHomeLayoutPayload,
} from "./home-section-registry";
import {
  HOME_PREFLIGHT_LOCALE_ORDER,
  type HomePreflightCellMeta,
  type HomePreflightInput,
  type HomePreflightLayoutMeta,
} from "./home-preflight";
import type { HomeSectionProjectionInput, SectionProjectionMap } from "./home-composer";
import {
  homeSectionMediaAssetIds,
  inspectHomeSectionBlocks,
  validateHomeSectionPayload,
  type HomeSectionBlocksPayload,
} from "./home-section-schemas";

export type HomePreflightSelection = Readonly<{
  /** Include the pending layout draft (if one exists) in this plan. */
  layoutSelected: boolean;
  /** Which (key, locale) pairs' pending drafts to include. A pair not
   * listed here is served from its current published state in the
   * candidate matrix, regardless of whether it has a pending draft. */
  sections: readonly Readonly<{ key: HomeSectionKey; locale: ContentLocale }>[];
}>;

/**
 * Selects every (key, locale) pair whose `ContentTranslation.draftRevisionId
 * !== publishedRevisionId`, plus `layoutSelected: true` iff `HomeLayout`'s
 * own draft/published pointers differ - the "default: all with a pending
 * draft" behavior AC-2.4-03 requires for the page's initial render.
 */
export async function buildDefaultHomePublishSelection(
  client: PrismaClient,
): Promise<HomePreflightSelection> {
  const layout = await client.homeLayout.findUnique({ where: { singleton: true } });
  const layoutSelected = Boolean(layout && layout.draftRevisionId !== layout.publishedRevisionId);

  const entities = await client.contentEntity.findMany({
    where: { contentType: { in: HOME_SECTION_KEYS.map(homeSectionContentType) } },
    select: { id: true, contentType: true },
  });
  const entityIds = entities.map((entity) => entity.id);
  const keyByEntityId = new Map<string, HomeSectionKey>();
  for (const entity of entities) {
    const key = HOME_SECTION_KEYS.find((candidate) => homeSectionContentType(candidate) === entity.contentType);
    if (key) keyByEntityId.set(entity.id, key);
  }

  const translations =
    entityIds.length > 0
      ? await client.contentTranslation.findMany({
          where: { entityId: { in: entityIds } },
          select: { entityId: true, locale: true, draftRevisionId: true, publishedRevisionId: true },
        })
      : [];

  const sections: Array<{ key: HomeSectionKey; locale: ContentLocale }> = [];
  for (const translation of translations) {
    const key = keyByEntityId.get(translation.entityId);
    if (!key) continue;
    if (translation.draftRevisionId !== translation.publishedRevisionId) {
      sections.push({ key, locale: translation.locale });
    }
  }

  return { layoutSelected, sections };
}

/**
 * Resolves everything `runHomePublishPreflight` needs for `selection`.
 *
 * Layout: reads `HomeLayout` directly (id, version, draftRevisionId,
 * publishedRevisionId) plus both revisions' payloads.
 * `candidateLayoutPayload`/`candidateLayoutRevisionId` come from the draft
 * revision when `selection.layoutSelected` is true and a draft exists,
 * otherwise from the published revision, otherwise
 * `defaultHomeLayoutPayload()` (only reachable before
 * `ensureHomeSectionRegistry()` has ever run).
 *
 * Sections: for each of the 11 `HOME_SECTION_KEYS`, looks up the backing
 * `HomeSection.entityId` once (batched - a single `findMany` filtered by
 * the 11 content types), then reads every locale's `ContentTranslation` in
 * one more `findMany` joined to `draftRevision`/`publishedRevision` -
 * never 44 individual round trips.
 */
export async function resolveHomePreflightInputs(
  client: PrismaClient,
  selection: HomePreflightSelection,
): Promise<HomePreflightInput> {
  const layout = await client.homeLayout.findUnique({
    where: { singleton: true },
    include: { draftRevision: true, publishedRevision: true },
  });

  const layoutId = layout?.id ?? "bootstrap-default";
  const layoutVersion = layout?.version ?? 0;
  const draftRevisionId = layout?.draftRevisionId ?? null;
  const publishedRevisionId = layout?.publishedRevisionId ?? null;
  const hasPendingDraft = draftRevisionId !== null && draftRevisionId !== publishedRevisionId;

  const useDraftLayout = selection.layoutSelected && layout?.draftRevision != null;
  const candidateLayoutPayload = useDraftLayout
    ? validateHomeLayoutPayload(layout!.draftRevision!.schemaVersion, layout!.draftRevision!.payload)
    : layout?.publishedRevision
      ? validateHomeLayoutPayload(layout.publishedRevision.schemaVersion, layout.publishedRevision.payload)
      : defaultHomeLayoutPayload();
  const candidateLayoutRevisionId = useDraftLayout
    ? layout!.draftRevisionId!
    : (layout?.publishedRevisionId ?? "bootstrap-default");
  const currentPublishedLayoutPayload = layout?.publishedRevision
    ? validateHomeLayoutPayload(layout.publishedRevision.schemaVersion, layout.publishedRevision.payload)
    : null;

  const layoutMeta: HomePreflightLayoutMeta = {
    layoutId,
    layoutVersion,
    draftRevisionId,
    publishedRevisionId,
    hasPendingDraft,
  };

  const entities = await client.contentEntity.findMany({
    where: { contentType: { in: HOME_SECTION_KEYS.map(homeSectionContentType) } },
    select: { id: true, contentType: true },
  });
  const entityIdByKey = new Map<HomeSectionKey, string>();
  const keyByEntityId = new Map<string, HomeSectionKey>();
  for (const entity of entities) {
    const key = HOME_SECTION_KEYS.find((candidate) => homeSectionContentType(candidate) === entity.contentType);
    if (!key) continue;
    entityIdByKey.set(key, entity.id);
    keyByEntityId.set(entity.id, key);
  }

  const entityIds = [...entityIdByKey.values()];
  const translations =
    entityIds.length > 0
      ? await client.contentTranslation.findMany({
          where: { entityId: { in: entityIds } },
          include: { draftRevision: true, publishedRevision: true },
        })
      : [];

  const translationByKeyLocale = new Map<string, (typeof translations)[number]>();
  for (const translation of translations) {
    const key = keyByEntityId.get(translation.entityId);
    if (!key) continue;
    translationByKeyLocale.set(`${key}:${translation.locale}`, translation);
  }

  const selectedSet = new Set(selection.sections.map((entry) => `${entry.key}:${entry.locale}`));

  const cellMeta = {} as Record<HomeSectionKey, Record<ContentLocale, HomePreflightCellMeta>>;
  const candidateProjectionsByLocale = {} as Record<ContentLocale, Record<HomeSectionKey, HomeSectionProjectionInput | null>>;
  for (const locale of HOME_PREFLIGHT_LOCALE_ORDER) {
    candidateProjectionsByLocale[locale] = {} as Record<HomeSectionKey, HomeSectionProjectionInput | null>;
  }

  for (const key of HOME_SECTION_KEYS) {
    cellMeta[key] = {} as Record<ContentLocale, HomePreflightCellMeta>;

    for (const locale of HOME_PREFLIGHT_LOCALE_ORDER) {
      const translation = translationByKeyLocale.get(`${key}:${locale}`);
      const isSelected = selectedSet.has(`${key}:${locale}`);
      const hasPendingDraftCell = Boolean(
        translation && translation.draftRevisionId !== translation.publishedRevisionId,
      );
      const candidateIsDraft = isSelected && Boolean(translation?.draftRevision);
      const candidateRevisionId = candidateIsDraft
        ? (translation!.draftRevisionId as string)
        : (translation?.publishedRevisionId ?? null);

      cellMeta[key][locale] = {
        entityId: entityIdByKey.get(key) ?? "",
        translationId: translation?.id ?? "",
        translationVersion: translation?.version ?? 0,
        hasPendingDraft: hasPendingDraftCell,
        candidateRevisionId,
        candidateIsDraft,
        blockIssues: [],
      };

      if (candidateRevisionId === null) {
        candidateProjectionsByLocale[locale][key] = null;
      } else if (candidateIsDraft) {
        const revision = translation!.draftRevision!;
        candidateProjectionsByLocale[locale][key] = {
          servedLocale: locale,
          servedRevisionId: revision.id,
          payload: revision.payload,
          schemaVersion: revision.schemaVersion,
          fallbackApplied: false,
          publishedAt: revision.createdAt,
        };
      } else {
        const revision = translation!.publishedRevision!;
        candidateProjectionsByLocale[locale][key] = {
          servedLocale: locale,
          servedRevisionId: revision.id,
          payload: revision.payload,
          schemaVersion: revision.schemaVersion,
          fallbackApplied: false,
          publishedAt: translation!.publishedAt!,
        };
      }
    }
  }

  // Published baseline (for `firstTimeFallbackWarnings`): `tr` never
  // falls back, so it is read directly per key; every other locale reuses
  // Story 2.3's own fallback-aware `resolveHomeProjection` rather than
  // reimplementing the tr-fallback hop here.
  const currentPublishedProjectionsByLocale = {} as Record<ContentLocale, SectionProjectionMap>;
  const trProjections = {} as Record<HomeSectionKey, HomeSectionProjectionInput | null>;
  for (const key of HOME_SECTION_KEYS) {
    const entityId = entityIdByKey.get(key);
    const published = entityId ? await getPublished(client, { entityId, locale: "tr" }) : null;
    trProjections[key] = published
      ? {
          servedLocale: "tr",
          servedRevisionId: published.publishedRevisionId,
          payload: published.payload,
          schemaVersion: published.schemaVersion,
          fallbackApplied: false,
          publishedAt: published.publishedAt,
        }
      : null;
  }
  currentPublishedProjectionsByLocale.tr = trProjections;

  for (const locale of HOME_PREFLIGHT_LOCALE_ORDER) {
    if (locale === "tr") continue;
    const projection = await resolveHomeProjection(client, {
      requestedLocale: locale,
      revisionSource: "published",
    });
    currentPublishedProjectionsByLocale[locale] = projection.sectionProjections;
  }
  // Per-cell block-level missing/media-missing findings (Story 2.4
  // correction). Parse every candidate payload once (an unparseable one is
  // already surfaced as the cell's own INVALID outcome, so it contributes
  // no block issues here), collect every referenced MediaAsset id across
  // all cells, then resolve which of those ids are still active in one
  // batch query - never one query per cell.
  const parsedCandidateByKeyLocale = new Map<string, HomeSectionBlocksPayload>();
  const referencedAssetIds = new Set<string>();
  for (const key of HOME_SECTION_KEYS) {
    for (const locale of HOME_PREFLIGHT_LOCALE_ORDER) {
      const projection = candidateProjectionsByLocale[locale][key];
      if (!projection) continue;
      try {
        const parsed = validateHomeSectionPayload(key, projection.schemaVersion, projection.payload);
        parsedCandidateByKeyLocale.set(`${key}:${locale}`, parsed);
        for (const assetId of homeSectionMediaAssetIds(parsed)) referencedAssetIds.add(assetId);
      } catch {
        // Invalid payload - already the cell's own INVALID outcome.
      }
    }
  }
  const activeAssets =
    referencedAssetIds.size > 0
      ? await client.mediaAsset.findMany({
          where: { id: { in: [...referencedAssetIds] }, archivedAt: null },
          select: { id: true },
        })
      : [];
  const activeMediaAssetIds = new Set(activeAssets.map((asset) => asset.id));

  for (const key of HOME_SECTION_KEYS) {
    for (const locale of HOME_PREFLIGHT_LOCALE_ORDER) {
      const parsed = parsedCandidateByKeyLocale.get(`${key}:${locale}`);
      cellMeta[key][locale] = {
        ...cellMeta[key][locale],
        blockIssues: parsed ? inspectHomeSectionBlocks(parsed, activeMediaAssetIds) : [],
      };
    }
  }


  return {
    candidateLayoutPayload,
    candidateLayoutRevisionId,
    currentPublishedLayoutPayload,
    layoutMeta,
    candidateProjectionsByLocale,
    currentPublishedProjectionsByLocale,
    cellMeta,
    registryVersion: 1,
  };
}
