import "server-only";
import { prisma } from "../db";
import { getMediaAsset, MediaError } from "../media/service";
import { resolvePublicMediaReference, type ResolvedPublicMedia } from "../content-model/public-media-resolver";
import { getStorageConfig } from "../media/storage";

function allowlist(): readonly string[] {
  const base = getStorageConfig().publicBaseUrl;
  if (!base) return [];
  try { return [new URL(base).hostname]; } catch { return []; }
}

/**
 * Eksik, arşivli veya okunamayan asset'ler her zaman güvenli yer tutucuya
 * düşer. `placeholderUrl` verildiğinde gri "Görsel Hazırlanıyor" SVG'si
 * yerine o yer tutucu (Unsplash dummy) gösterilir; `isFallback` yine `true`
 * kalır, böylece SEO/og:image tarafı bunu gerçek içerik görseli saymaz.
 */
export async function resolvePublicImage(
  assetId: string | null,
  placeholderUrl?: string,
): Promise<ResolvedPublicMedia> {
  const resolved = await resolveAsset(assetId);
  if (resolved.isFallback && resolved.kind === "image" && placeholderUrl) {
    return { ...resolved, url: placeholderUrl };
  }
  return resolved;
}

async function resolveAsset(assetId: string | null): Promise<ResolvedPublicMedia> {
  if (!assetId) return resolvePublicMediaReference({ asset: null }, allowlist());
  try {
    const asset = await getMediaAsset(prisma, assetId);
    return resolvePublicMediaReference({ asset: asset.archived ? null : asset }, allowlist());
  } catch (error) {
    if (error instanceof MediaError) return resolvePublicMediaReference({ asset: null }, allowlist());
    throw error;
  }
}
