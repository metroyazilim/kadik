import type { ContentLocale } from "@prisma/client";
import { resolveMediaOrFallback, type ResolvedMediaView } from "../media/fallback";
import type { MediaAssetDto, MediaKind, MediaUsageDto } from "../media/types";

/** Trusted hostnames only - the R2 public bucket domain and any configured
 * custom domain. Never a URL prefix (a similar-looking hostname is not the
 * same host - `translate.googleapis.com` vs `translate-pa.googleapis.com`
 * is the exact confusion this check exists to prevent). Caller-supplied,
 * never hardcoded here - the same "config as caller input, not a literal in
 * policy code" discipline `route-registry.ts`'s `collectionSegment` uses. */
export type PublicMediaAllowlist = readonly string[];

export type PublicMediaReference = Readonly<{
  asset: MediaAssetDto | null;
  /** The specific `(entity, surface, field, locale)` usage row, when one
   * exists - carries the locale-scoped `altText` override. */
  usage?: MediaUsageDto | null;
}>;

export type ResolvedPublicMedia = ResolvedMediaView &
  Readonly<{
    /** `false` whenever the asset was rejected for an unverified origin,
     * not merely because no asset was supplied - distinct from
     * `isFallback` (which fires for both). A future secure-image-proxy
     * wrapper reads this to decide `unoptimized`/direct-vs-proxied
     * delivery once storage config (Epic 4) is finalized; wiring that
     * proxy route itself is out of this function's scope. */
    originVerified: boolean;
  }>;

function isVerifiedOrigin(url: string, allowedHosts: PublicMediaAllowlist): boolean {
  if (allowedHosts.length === 0) return false;
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "https:" &&
      parsed.username === "" &&
      parsed.password === "" &&
      parsed.port === "" &&
      allowedHosts.includes(parsed.hostname)
    );
  } catch {
    return false;
  }
}

/** A usage row's locale-scoped `altText` override only applies when the row
 * genuinely belongs to the asset being resolved - a usage row queried
 * loosely (or supplied by a caller bug) for a *different* asset must never
 * leak its own alt text onto this one. When a specific `locale` was
 * requested, the usage's own `locale` must match it exactly (`null`
 * applies to no specific locale, so it never overrides a locale-scoped
 * request); with no requested locale, any usage row for this asset
 * applies. */
function usageAltTextFor(
  asset: MediaAssetDto,
  usage: MediaUsageDto | null | undefined,
  locale: ContentLocale | undefined,
): string | undefined {
  if (!usage || usage.assetId !== asset.id) return undefined;
  if (locale !== undefined && usage.locale !== null && usage.locale !== locale) return undefined;
  const trimmed = usage.altText?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Resolves a public media reference exclusively through an already-fetched
 * `MediaAsset`/`MediaUsage` snapshot (per "Medya yalnız MediaAsset üzerinden
 * çözülecek") - never an arbitrary admin-supplied string URL, and never a
 * Prisma read of its own (pure, mirroring this epic's read-model
 * discipline). The asset's own `url` is verified against a caller-supplied
 * hostname allowlist before it is ever returned; an asset with no
 * verified origin - or no asset at all, or one the admin surface's own
 * archived/`storageStatus: MISSING` check already flags broken - always
 * falls back to `resolveMediaOrFallback`'s existing placeholder (Story
 * 4.1), never a second, independently-invented fallback image.
 *
 * Locale-aware alt text prefers the per-`(entity, surface, field, locale)`
 * `MediaUsage.altText` over the shared `MediaAsset.altText` over
 * `resolveMediaOrFallback`'s own generic default - a locale-scoped
 * override always wins over an asset-wide one.
 */
export function resolvePublicMediaReference(
  reference: PublicMediaReference,
  allowedHosts: PublicMediaAllowlist,
  options?: Readonly<{ fallbackKind?: MediaKind; locale?: ContentLocale }>,
): ResolvedPublicMedia {
  const { asset, usage } = reference;

  if (!asset || !isVerifiedOrigin(asset.url, allowedHosts)) {
    return { ...resolveMediaOrFallback(null, options), originVerified: false };
  }

  const localeAlt = usageAltTextFor(asset, usage, options?.locale);
  const candidate: MediaAssetDto = {
    ...asset,
    altText: localeAlt ?? asset.altText,
  };

  return { ...resolveMediaOrFallback(candidate, options), originVerified: true };
}
