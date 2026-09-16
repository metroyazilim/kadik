import type { ContentLocale, PrismaClient } from "@prisma/client";
import { composeHomeFromDatabase } from "./home-projection";
import type { HomeComposition } from "./home-composer";
import { homeSectionMediaAssetIds, homeSectionPayloadSchema } from "./home-section-schemas";

export type HomePublicMediaAsset = Readonly<{ url: string }>;

export type HomePublicView = Readonly<{
  composition: HomeComposition;
  mediaAssetsById: Readonly<Record<string, HomePublicMediaAsset>>;
}>;

/** Public Home resolves only the eleven code-owned sections and their published locale revisions. */
export async function loadPublicHomeView(
  client: PrismaClient,
  requestedLocale: ContentLocale,
): Promise<HomePublicView> {
  const composition = await composeHomeFromDatabase(client, {
    requestedLocale,
    revisionSource: "published",
  });

  const assetIds = new Set<string>();
  for (const section of composition.sections) {
    const payload = homeSectionPayloadSchema.safeParse(section.payload);
    if (!payload.success) continue;
    for (const assetId of homeSectionMediaAssetIds(payload.data)) assetIds.add(assetId);
  }

  const assets = assetIds.size
    ? await client.mediaAsset.findMany({
        where: { id: { in: [...assetIds] }, archivedAt: null },
        select: { id: true, url: true },
      })
    : [];

  return {
    composition,
    mediaAssetsById: Object.fromEntries(
      assets.map((asset) => [asset.id, { url: asset.url }]),
    ),
  };
}
