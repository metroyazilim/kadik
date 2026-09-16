import type { MetadataRoute } from "next";
import { getAllPublishedRoutesForSitemap } from "@/lib/content-model/route-reader";
import { buildSitemapEntries } from "@/lib/content-model/public-seo";
import {
  SERVICE_CONTENT_TYPE,
  PRODUCT_CONTENT_TYPE,
  PROJECT_CONTENT_TYPE,
  TEAM_MEMBER_CONTENT_TYPE,
  POST_CONTENT_TYPE,
} from "@/lib/content-model/payload-validation";
import { LOCALES, SITE_URL } from "@/lib/i18n/config";
import { STATIC_PAGE_KEYS, staticPath } from "@/lib/i18n/static-pages";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Story 6.2 CAP-2: every routable content type's own published, native
 * addresses - FAQ and legal pages are structurally excluded (no
 * ContentRoute is ever created for either, see SPEC.md's Constraints). */
const SITEMAP_CONTENT_TYPES = [
  SERVICE_CONTENT_TYPE,
  PRODUCT_CONTENT_TYPE,
  PROJECT_CONTENT_TYPE,
  TEAM_MEMBER_CONTENT_TYPE,
  POST_CONTENT_TYPE,
] as const;

/** Spec 2 section 9.1: the eight static-page keys at every locale's own
 * canonical (Turkish-prefixless, others locale-prefixed) address - never a
 * `/tr/` URL, never a fallback alias. No `lastModified`: these pages have
 * no CMS revision timestamp to report. */
function staticSitemapEntries(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [];
  for (const key of STATIC_PAGE_KEYS) {
    for (const locale of LOCALES) {
      entries.push({ url: `${SITE_URL}${staticPath(locale, key)}` });
    }
  }
  return entries;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const rowsByType = await Promise.all(
    SITEMAP_CONTENT_TYPES.map((contentType) => getAllPublishedRoutesForSitemap(prisma, contentType)),
  );
  const entries = buildSitemapEntries(rowsByType.flat());

  return [
    ...staticSitemapEntries(),
    ...entries.map((entry) => ({
      url: `${SITE_URL}${entry.url}`,
      lastModified: entry.lastModified,
    })),
  ];
}
