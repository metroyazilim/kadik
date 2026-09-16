import "server-only";
import type { ContentLocale } from "@prisma/client";
import { prisma } from "../db";
import { resolve } from "../content-model/public-content-reader";
import { getPublishedRouteCandidates } from "../content-model/route-reader";
import { generateRoute, resolvePublicRoute } from "../content-model/route-registry";
import { findPublishedPostByRoute } from "../content-model/post-route-lookup";
import { POST_COLLECTION_SEGMENTS } from "../content-model/post-routes";
import { POST_CONTENT_TYPE, type PostPayload } from "../content-model/payload-validation";
import type { ResolvedPublicMedia } from "../content-model/public-media-resolver";
import { resolvePublicContentBlocks, type PublicContentBlock } from "./content-blocks";
import { resolvePublicImage } from "./media";
import { DUMMY_BLOG_IMAGES, dummyImage } from "../media/dummy-images";

async function publishedAtOf(entityId: string, locale: ContentLocale): Promise<Date> {
  const translation = await prisma.contentTranslation.findUnique({
    where: { entityId_locale: { entityId, locale } },
    select: { publishedAt: true },
  });
  return translation?.publishedAt ?? new Date(0);
}

export type PublicPostListItem = Readonly<{
  entityId: string;
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  author: string;
  publishedAt: Date;
  coverImage: ResolvedPublicMedia;
}>;

/** Lists only entities with a published requested-locale or Turkish fallback projection, newest publication first. */
export async function listPublishedPosts(locale: ContentLocale): Promise<PublicPostListItem[]> {
  const entities = await prisma.contentEntity.findMany({
    where: { contentType: POST_CONTENT_TYPE, archived: false },
    select: { id: true },
  });

  const projections = await Promise.all(
    entities.map(async ({ id }, index): Promise<PublicPostListItem | null> => {
      const result = await resolve(prisma, { entityId: id, contentType: POST_CONTENT_TYPE, requestedLocale: locale });
      if (result.emptyReason !== null || result.payload === null || result.servedLocale === null) return null;

      const routes = await getPublishedRouteCandidates(prisma, id);
      const servedRoute = routes.find((route) => route.locale === result.servedLocale);
      if (!servedRoute) return null;

      const payload = result.payload as unknown as PostPayload;
      const [coverImage, publishedAt] = await Promise.all([
        resolvePublicImage(payload.coverImageAssetId, dummyImage(DUMMY_BLOG_IMAGES, index)),
        publishedAtOf(id, result.servedLocale),
      ]);
      return {
        entityId: id,
        slug: servedRoute.slug,
        title: payload.title,
        excerpt: payload.excerpt,
        category: payload.category,
        author: payload.author,
        publishedAt,
        coverImage,
      };
    }),
  );

  return projections
    .filter((item): item is PublicPostListItem => item !== null)
    .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
}

export type PublicPostDetail = PublicPostListItem &
  Readonly<{
    blocks: readonly PublicContentBlock[];
    seoTitle: string | null;
    seoDescription: string | null;
    canonicalUrl: string;
    noindex: boolean;
  }>;

/** Resolves the incoming native route first, then permits the same raw slug to identify a published Turkish source route for a locale fallback view. */
export async function getPublishedPostByRoute(locale: ContentLocale, slug: string): Promise<PublicPostDetail | null> {
  const native = await findPublishedPostByRoute(prisma, locale, POST_COLLECTION_SEGMENTS[locale], slug);
  const found =
    native ??
    (locale === "tr" ? null : await findPublishedPostByRoute(prisma, "tr", POST_COLLECTION_SEGMENTS.tr, slug));
  if (!found) return null;

  const result = await resolve(prisma, { entityId: found.entityId, contentType: POST_CONTENT_TYPE, requestedLocale: locale });
  if (result.emptyReason !== null || result.payload === null || result.servedLocale === null) return null;

  const routes = await getPublishedRouteCandidates(prisma, found.entityId);
  const routeResolution = resolvePublicRoute(found.entityId, locale, routes);
  if (routeResolution.kind === "notFound") return null;

  // Stale alias (Story 6.2 AC-6.2-04): see service.ts's identical comment.
  if (!native && routeResolution.kind === "native") return null;

  const servedRoute = routes.find((route) => route.locale === result.servedLocale);
  if (!servedRoute) return null;

  const payload = result.payload as unknown as PostPayload;
  const [coverImage, blocks, publishedAt] = await Promise.all([
    resolvePublicImage(payload.coverImageAssetId, DUMMY_BLOG_IMAGES[0]),
    resolvePublicContentBlocks(payload.blocks),
    publishedAtOf(found.entityId, result.servedLocale),
  ]);
  return {
    entityId: found.entityId,
    slug: servedRoute.slug,
    title: payload.title,
    excerpt: payload.excerpt,
    category: payload.category,
    author: payload.author,
    publishedAt,
    coverImage,
    blocks,
    seoTitle: payload.seoTitle,
    seoDescription: payload.seoDescription,
    canonicalUrl: routeResolution.kind === "fallback" ? routeResolution.canonical : routeResolution.url,
    noindex: routeResolution.kind === "fallback" ? routeResolution.noindex : false,
  };
}

/** Returns hreflang candidates only for locales with an actual published route. */
export async function getPostAlternates(entityId: string): Promise<Readonly<Partial<Record<ContentLocale, string>>>> {
  const routes = await getPublishedRouteCandidates(prisma, entityId);
  const alternates: Partial<Record<ContentLocale, string>> = {};
  for (const route of routes) alternates[route.locale] = generateRoute(route);
  return alternates;
}
