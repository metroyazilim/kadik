import type { ContentLocale, PrismaClient } from "@prisma/client";
import { ContentModelError } from "./errors";

/**
 * Content-domain payloads never carry an arbitrary image URL - only a
 * `MediaAsset.id` minted by the media library (Story 4.1). This is the one
 * gate every domain's save-draft server action calls before `adminSaveDraft`
 * ever sees the payload: it proves every referenced id is a real, non-archived
 * asset, so a tampered form submission can never smuggle in an id for an
 * asset that does not exist (or was archived out from under it) and a
 * revision can never be created pointing at nothing.
 */
export async function assertMediaAssetsExist(
  prisma: PrismaClient,
  assetIds: readonly (string | null | undefined)[],
): Promise<void> {
  const unique = [...new Set(assetIds.filter((id): id is string => Boolean(id)))];
  if (unique.length === 0) return;

  const rows = await prisma.mediaAsset.findMany({
    where: { id: { in: unique } },
    select: { id: true, archivedAt: true },
  });
  const byId = new Map(rows.map((row) => [row.id, row]));

  for (const id of unique) {
    const row = byId.get(id);
    if (!row) {
      throw new ContentModelError("invalidInput", `Media asset '${id}' was not found.`);
    }
    if (row.archivedAt !== null) {
      throw new ContentModelError("invalidInput", `Media asset '${id}' is archived and cannot be linked.`);
    }
  }
}

export type SyncFieldMediaUsageInput = Readonly<{
  entityId: string;
  locale: ContentLocale;
  surface: string;
  field: string;
  assetIds: readonly (string | null | undefined)[];
}>;

/**
 * Reconciles `MediaUsage` rows for one `(entityId, locale, surface, field)`
 * key to exactly the given asset id set - creating rows for newly-linked
 * assets and removing rows for assets no longer referenced. Called after a
 * successful `adminSaveDraft`/`adminPublish`, never inside `publishing.ts`'s
 * own transaction (usage tracking is a dependency-safety net for Epic 4/3.5,
 * not part of the draft/publish pointer-swap contract itself - a transient
 * failure here never corrupts the content pointer that already committed).
 */
export async function syncFieldMediaUsage(
  prisma: PrismaClient,
  input: SyncFieldMediaUsageInput,
): Promise<void> {
  const desired = [...new Set(input.assetIds.filter((id): id is string => Boolean(id)))];
  const existing = await prisma.mediaUsage.findMany({
    where: {
      entityId: input.entityId,
      locale: input.locale,
      surface: input.surface,
      field: input.field,
    },
  });

  const existingAssetIds = new Set(existing.map((row) => row.assetId));
  const toRemove = existing.filter((row) => !desired.includes(row.assetId));
  const toAdd = desired.filter((id) => !existingAssetIds.has(id));
  if (toRemove.length === 0 && toAdd.length === 0) return;

  await prisma.$transaction([
    ...toRemove.map((row) => prisma.mediaUsage.delete({ where: { id: row.id } })),
    ...toAdd.map((assetId) =>
      prisma.mediaUsage.create({
        data: {
          assetId,
          entityId: input.entityId,
          locale: input.locale,
          surface: input.surface,
          field: input.field,
        },
      }),
    ),
  ]);
}


export type MediaAssetPreview = Readonly<{ url: string; filename: string; mimeType: string }>;

/**
 * Batch-resolves `MediaAsset` previews (admin-only: no archived/placeholder
 * substitution - this is for the block editor showing the admin what asset
 * is actually linked, not a public render) for every asset id referenced by
 * a block array's IMAGE/BANNER fields, keyed by asset id. Missing ids are
 * simply absent from the result map - the editor renders those blocks as
 * "asset not found", never a thrown error, since a stale/removed asset
 * reference must stay visible and fixable, not crash the drawer.
 */
export async function resolveMediaAssetPreviews(
  prisma: PrismaClient,
  assetIds: readonly (string | null | undefined)[],
): Promise<Readonly<Record<string, MediaAssetPreview>>> {
  const unique = [...new Set(assetIds.filter((id): id is string => Boolean(id)))];
  if (unique.length === 0) return {};

  const rows = await prisma.mediaAsset.findMany({
    where: { id: { in: unique } },
    select: { id: true, url: true, filename: true, mimeType: true },
  });

  const result: Record<string, MediaAssetPreview> = {};
  for (const row of rows) {
    result[row.id] = { url: row.url, filename: row.filename, mimeType: row.mimeType };
  }
  return result;
}
