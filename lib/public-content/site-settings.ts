import "server-only";
import { cache } from "react";
import type { ContentLocale } from "@prisma/client";
import { prisma } from "../db";
import { resolve } from "../content-model/public-content-reader";
import { getSiteSettingsEntityId } from "../content-model/site-settings-registry";
import { SITE_SETTINGS_CONTENT_TYPE, SITE_SETTINGS_SCHEMA_VERSION, validateSiteSettingsPayload } from "../content-model/site-settings-schema";
import { composePublicFooter, composePublicNavigation, type PublicFooterColumn, type PublicNavItem } from "../content-model/site-settings-nav";
import type { ResolvedPublicMedia } from "../content-model/public-media-resolver";
import { resolvePublicImage } from "./media";

export type PublicSiteSettings = Readonly<{
  brand: Readonly<{ name: string; logo: ResolvedPublicMedia }>;
  contact: Readonly<{ email: string | null; phone: string | null; address: string | null }>;
  cta: Readonly<{ label: string; url: string } | null>;
  navigation: readonly PublicNavItem[];
  footer: Readonly<{ summary: string; columns: readonly PublicFooterColumn[] }>;
  mission: string;
  vision: string;
  servedLocale: ContentLocale;
  fallbackApplied: boolean;
}>;

/**
 * `null` means "no published site-settings projection exists for any
 * locale yet" (a fresh environment before the first publish, or the Story
 * 0.2 registry never bootstrapped) - every caller treats that exactly like
 * a missing dictionary override: fall back to the checked-in dictionary
 * content unchanged, never a broken page. A malformed/unvalidatable
 * published payload (should be impossible given publish-time validation,
 * but this read path never trusts stored JSON blindly) falls back the
 * same safe way, never a thrown 500. A database that isn't reachable yet
 * (e.g. a Docker build's placeholder `DATABASE_URL`, or the app booting
 * before Postgres is ready) is treated identically - mirrors
 * `getPublicDictionary()`'s outer try/catch.
 *
 * Wrapped in React's request-scoped `cache()`: `SiteHeader`, `Footer`, and
 * `TopBar`/`MobileMenu` (fed by `SiteHeader`) all call this for the same
 * `(requestedLocale)` within one page render, and share a single query
 * instead of issuing one each.
 */
export const getPublicSiteSettings = cache(async (requestedLocale: ContentLocale): Promise<PublicSiteSettings | null> => {
  try {
    const entityId = await getSiteSettingsEntityId(prisma);
    if (!entityId) return null;

    const result = await resolve(prisma, {
      entityId,
      contentType: SITE_SETTINGS_CONTENT_TYPE,
      requestedLocale,
    });
    if (result.payload === null || result.servedLocale === null) return null;

    const payload = validateSiteSettingsPayload(SITE_SETTINGS_SCHEMA_VERSION, result.payload);
    const [logo, navigation, footerColumns] = await Promise.all([
      resolvePublicImage(payload.brand.logoAssetId),
      composePublicNavigation(prisma, result.servedLocale, payload.navigation),
      composePublicFooter(prisma, result.servedLocale, payload.footer.columns),
    ]);

    return {
      brand: { name: payload.brand.name, logo },
      contact: payload.contact,
      cta: payload.cta.label && payload.cta.url ? { label: payload.cta.label, url: payload.cta.url } : null,
      navigation,
      footer: { summary: payload.footer.summary, columns: footerColumns },
      mission: payload.mission,
      vision: payload.vision,
      servedLocale: result.servedLocale,
      fallbackApplied: result.fallbackApplied,
    };
  } catch (error) {
    console.error("Metro Yazılım site settings read failed; using dictionary-only shell", error);
    return null;
  }
});

export type PublicLegalDocument = Readonly<{
  body: string;
  servedLocale: ContentLocale;
  fallbackApplied: boolean;
  noindex: boolean;
}>;

/** Terms/privacy body only, from the same published site-settings projection - never a second, independent read path. Unreachable database (see `getPublicSiteSettings`) resolves to `null` the same way as "no legal document published yet". */
export async function getPublicLegalDocument(
  requestedLocale: ContentLocale,
  document: "terms" | "privacy",
): Promise<PublicLegalDocument | null> {
  try {
    const entityId = await getSiteSettingsEntityId(prisma);
    if (!entityId) return null;

    const result = await resolve(prisma, {
      entityId,
      contentType: SITE_SETTINGS_CONTENT_TYPE,
      requestedLocale,
    });
    if (result.payload === null || result.servedLocale === null) return null;

    const payload = validateSiteSettingsPayload(SITE_SETTINGS_SCHEMA_VERSION, result.payload);
    const body = document === "terms" ? payload.termsBody : payload.privacyBody;
    if (!body) return null;

    return {
      body,
      servedLocale: result.servedLocale,
      fallbackApplied: result.fallbackApplied,
      noindex: result.canonical?.noindex ?? false,
    };
  } catch (error) {
    console.error("Metro Yazılım legal document read failed", error);
    return null;
  }
}
