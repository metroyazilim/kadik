import "server-only";
import { cache } from "react";
import type { ContentLocale } from "@prisma/client";
import { prisma } from "../db";
import { resolve, type PublicProjectionResult } from "../content-model/public-content-reader";
import { getContentPageEntityId } from "../content-model/content-page-registry";
import {
  ABOUT_PAGE_CONTENT_TYPE,
  ABOUT_PAGE_SCHEMA_VERSION,
  validateAboutPagePayload,
  type AboutPagePayload,
} from "../content-model/about-page-schema";
import { resolvePublicImage } from "./media";
import { DUMMY_ABOUT_IMAGE, DUMMY_TEAM_IMAGES } from "../media/dummy-images";
import type { ResolvedPublicMedia } from "../content-model/public-media-resolver";

export type PublicAboutPage = Readonly<{
  page: AboutPagePayload;
  collageImage: ResolvedPublicMedia;
  authorImage: ResolvedPublicMedia;
  servedLocale: ContentLocale;
  fallbackApplied: boolean;
}>;

/**
 * The one published-only read path for the About content page (Spec 3,
 * mirrors `getPublicSiteSettings`'s shape exactly): `resolve()` already
 * implements AD-5's fallback/empty classification (native -> Turkish
 * fallback -> empty), so this function only has to validate the payload
 * `resolve()` handed back and resolve its two media references. `null`
 * means "no published About payload exists in this locale or in Turkish" -
 * the caller (`lib/public-pages/about.tsx`) renders the same `notFound()`/
 * empty-state surface every other content type's public reader drives.
 *
 * Wrapped in React's request-scoped `cache()`: `AboutPage` and
 * `generateAboutMetadata` both call this for the same `(locale)` within
 * one request and share a single resolution.
 */
export const getPublicAboutPage = cache(async (requestedLocale: ContentLocale): Promise<PublicAboutPage | null> => {
  const entityId = await getContentPageEntityId(prisma, "about");
  if (!entityId) return null;

  const result: PublicProjectionResult = await resolve(prisma, {
    entityId,
    contentType: ABOUT_PAGE_CONTENT_TYPE,
    requestedLocale,
  });
  if (result.payload === null || result.servedLocale === null) return null;

  try {
    const page = validateAboutPagePayload(ABOUT_PAGE_SCHEMA_VERSION, result.payload);
    const [collageImage, authorImage] = await Promise.all([
      resolvePublicImage(page.collageImageAssetId, DUMMY_ABOUT_IMAGE),
      resolvePublicImage(page.authorImageAssetId, DUMMY_TEAM_IMAGES[0]),
    ]);
    return {
      page,
      collageImage,
      authorImage,
      servedLocale: result.servedLocale,
      fallbackApplied: result.fallbackApplied,
    };
  } catch {
    return null;
  }
});
