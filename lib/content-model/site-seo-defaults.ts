import type { ContentLocale, PrismaClient } from "@prisma/client";
import { resolve } from "./public-content-reader";
import { getSiteSettingsEntityId } from "./site-settings-registry";
import { SITE_SETTINGS_CONTENT_TYPE, SITE_SETTINGS_SCHEMA_VERSION, validateSiteSettingsPayload } from "./site-settings-schema";
import { resolvePublicMediaReference } from "./public-media-resolver";
import type { SiteSeoDefaults } from "./public-seo";
import { getMediaAsset, MediaError } from "../media/service";
import { getStorageConfig } from "../media/storage";

/** The exact literal `SiteHeader.tsx` already hardcodes as its own brand
 * fallback when neither a logo nor a brand name is published - reused
 * verbatim here, never a second invented default. */
const DEFAULT_SITE_NAME = "Starter Kurumsal";

function publicMediaAllowlist(): readonly string[] {
  const base = getStorageConfig().publicBaseUrl;
  if (!base) return [];
  try {
    return [new URL(base).hostname];
  } catch {
    return [];
  }
}

/**
 * Story 6.2 CAP-1's upstream: derives `SiteSeoDefaults` from the real,
 * already-published `SiteSettingsPayload` (Story 6.1) - no new Story 6.1
 * schema field. Lives in `lib/content-model/` (not `lib/public-content/`,
 * every file of which imports `"server-only"` and is therefore only
 * resolvable inside a Next.js request) so it is directly testable against
 * Story 0.1's isolated per-run PostgreSQL schema, matching `route-reader.ts`'s
 * own testable-companion convention - accepts `client` explicitly rather
 * than the hardcoded `prisma` singleton `lib/public-content/site-settings.ts`'s
 * `getPublicSiteSettings` uses. A page render passes the shared `prisma`
 * singleton exactly like every other content-model reader.
 *
 * `null`/malformed/unpublished site-settings all fall back to the same
 * safe triple, never a thrown error - mirroring `getPublicSiteSettings`'s
 * own fallback contract.
 */
export async function getSiteSeoDefaults(
  client: PrismaClient,
  requestedLocale: ContentLocale,
): Promise<SiteSeoDefaults> {
  const fallback: SiteSeoDefaults = {
    siteName: DEFAULT_SITE_NAME,
    defaultDescription: "",
    defaultOgImageUrl: null,
  };

  const entityId = await getSiteSettingsEntityId(client);
  if (!entityId) return fallback;

  const result = await resolve(client, {
    entityId,
    contentType: SITE_SETTINGS_CONTENT_TYPE,
    requestedLocale,
  });
  if (result.payload === null) return fallback;

  try {
    const payload = validateSiteSettingsPayload(SITE_SETTINGS_SCHEMA_VERSION, result.payload);

    let logo;
    if (!payload.brand.logoAssetId) {
      logo = resolvePublicMediaReference({ asset: null }, publicMediaAllowlist());
    } else {
      try {
        const asset = await getMediaAsset(client, payload.brand.logoAssetId);
        logo = resolvePublicMediaReference({ asset: asset.archived ? null : asset }, publicMediaAllowlist());
      } catch (error) {
        if (!(error instanceof MediaError)) throw error;
        logo = resolvePublicMediaReference({ asset: null }, publicMediaAllowlist());
      }
    }

    return {
      siteName: payload.brand.name.trim().length > 0 ? payload.brand.name : DEFAULT_SITE_NAME,
      defaultDescription: payload.mission,
      defaultOgImageUrl: logo.isFallback ? null : logo.url,
    };
  } catch {
    return fallback;
  }
}
