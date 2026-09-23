import type { PrismaClient } from "@prisma/client";
import type { CollectionRow } from "./collection-admin";

/**
 * Resolves the image shown next to each row of an admin list (a board
 * member's portrait, a post's cover). One bounded query for the page's rows;
 * archived or missing assets simply produce no thumbnail.
 */
export async function listThumbnails(
  client: PrismaClient,
  rows: readonly CollectionRow[],
  field: "imageAssetId" | "coverImageAssetId",
): Promise<Record<string, string>> {
  const assetByEntity = new Map<string, string>();
  for (const row of rows) {
    const payload = row.displayPayload as Record<string, unknown> | null;
    const assetId = payload?.[field];
    if (typeof assetId === "string" && assetId.length > 0) assetByEntity.set(row.entityId, assetId);
  }
  if (assetByEntity.size === 0) return {};
  const assets = await client.mediaAsset.findMany({
    where: { id: { in: [...new Set(assetByEntity.values())] } },
    select: { id: true, url: true },
  });
  const urlById = new Map(assets.map((asset) => [asset.id, asset.url]));
  const result: Record<string, string> = {};
  for (const [entityId, assetId] of assetByEntity) {
    const url = urlById.get(assetId);
    if (url) result[entityId] = url;
  }
  return result;
}
