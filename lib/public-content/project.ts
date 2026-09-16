import "server-only";
import type { ContentLocale } from "@prisma/client";
import { prisma } from "../db";
import { resolve } from "../content-model/public-content-reader";
import { getPublishedRouteCandidates } from "../content-model/route-reader";
import { generateRoute, resolvePublicRoute } from "../content-model/route-registry";
import { findPublishedProjectByRoute } from "../content-model/project-route-lookup";
import { PROJECT_COLLECTION_SEGMENTS } from "../content-model/project-routes";
import { PROJECT_CONTENT_TYPE, type ProjectPayload } from "../content-model/payload-validation";
import type { ResolvedPublicMedia } from "../content-model/public-media-resolver";
import { resolvePublicContentBlocks, type PublicContentBlock } from "./content-blocks";
import { resolvePublicImage } from "./media";
import { DUMMY_PROJECT_IMAGES, dummyImage } from "../media/dummy-images";

export type PublicProjectListItem = Readonly<{
  entityId: string;
  slug: string;
  title: string;
  category: string;
  coverImage: ResolvedPublicMedia;
}>;

export async function listPublishedProjects(locale: ContentLocale): Promise<PublicProjectListItem[]> {
  const entities = await prisma.contentEntity.findMany({
    where: { contentType: PROJECT_CONTENT_TYPE, archived: false },
    select: { id: true },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  });

  const projections = await Promise.all(
    entities.map(async ({ id }, index): Promise<PublicProjectListItem | null> => {
      const result = await resolve(prisma, { entityId: id, contentType: PROJECT_CONTENT_TYPE, requestedLocale: locale });
      if (result.emptyReason !== null || result.payload === null || result.servedLocale === null) return null;

      const routes = await getPublishedRouteCandidates(prisma, id);
      const servedRoute = routes.find((route) => route.locale === result.servedLocale);
      if (!servedRoute) return null;

      const payload = result.payload as unknown as ProjectPayload;
      const coverImage = await resolvePublicImage(payload.coverImageAssetId, dummyImage(DUMMY_PROJECT_IMAGES, index));
      return { entityId: id, slug: servedRoute.slug, title: payload.title, category: payload.category, coverImage };
    }),
  );

  return projections.filter((item): item is PublicProjectListItem => item !== null);
}

export type PublicProjectDetail = PublicProjectListItem &
  Readonly<{
    challengeBlocks: readonly PublicContentBlock[];
    solutionBlocks: readonly PublicContentBlock[];
    client: string | null;
    gallery: readonly ResolvedPublicMedia[];
    seoTitle: string | null;
    seoDescription: string | null;
    canonicalUrl: string;
    noindex: boolean;
  }>;

export async function getPublishedProjectByRoute(locale: ContentLocale, slug: string): Promise<PublicProjectDetail | null> {
  const native = await findPublishedProjectByRoute(prisma, locale, PROJECT_COLLECTION_SEGMENTS[locale], slug);
  const found =
    native ?? (locale === "tr" ? null : await findPublishedProjectByRoute(prisma, "tr", PROJECT_COLLECTION_SEGMENTS.tr, slug));
  if (!found) return null;

  const result = await resolve(prisma, { entityId: found.entityId, contentType: PROJECT_CONTENT_TYPE, requestedLocale: locale });
  if (result.emptyReason !== null || result.payload === null || result.servedLocale === null) return null;

  const routes = await getPublishedRouteCandidates(prisma, found.entityId);
  const routeResolution = resolvePublicRoute(found.entityId, locale, routes);
  if (routeResolution.kind === "notFound") return null;

  // Stale alias (Story 6.2 AC-6.2-04): see service.ts's identical comment.
  if (!native && routeResolution.kind === "native") return null;

  const servedRoute = routes.find((route) => route.locale === result.servedLocale);
  if (!servedRoute) return null;

  const payload = result.payload as unknown as ProjectPayload;
  const [coverImage, gallery, challengeBlocks, solutionBlocks] = await Promise.all([
    resolvePublicImage(payload.coverImageAssetId, DUMMY_PROJECT_IMAGES[0]),
    Promise.all(payload.galleryAssetIds.map((assetId) => resolvePublicImage(assetId))),
    resolvePublicContentBlocks(payload.challengeBlocks),
    resolvePublicContentBlocks(payload.solutionBlocks),
  ]);

  return {
    entityId: found.entityId,
    slug: servedRoute.slug,
    title: payload.title,
    category: payload.category,
    coverImage,
    challengeBlocks,
    solutionBlocks,
    client: payload.client,
    gallery,
    seoTitle: payload.seoTitle,
    seoDescription: payload.seoDescription,
    canonicalUrl: routeResolution.kind === "fallback" ? routeResolution.canonical : routeResolution.url,
    noindex: routeResolution.kind === "fallback" ? routeResolution.noindex : false,
  };
}

export async function getProjectAlternates(entityId: string): Promise<Readonly<Partial<Record<ContentLocale, string>>>> {
  const routes = await getPublishedRouteCandidates(prisma, entityId);
  const alternates: Partial<Record<ContentLocale, string>> = {};
  for (const route of routes) alternates[route.locale] = generateRoute(route);
  return alternates;
}
