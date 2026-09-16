import "server-only";
import type { ContentLocale } from "@prisma/client";
import { prisma } from "../db";
import { resolve } from "../content-model/public-content-reader";
import { getPublishedRouteCandidates } from "../content-model/route-reader";
import { generateRoute, resolvePublicRoute } from "../content-model/route-registry";
import { findPublishedProductByRoute } from "../content-model/product-route-lookup";
import { PRODUCT_COLLECTION_SEGMENTS } from "../content-model/product-routes";
import { PRODUCT_CONTENT_TYPE, type ProductPayload } from "../content-model/payload-validation";
import type { ResolvedPublicMedia } from "../content-model/public-media-resolver";
import { resolvePublicContentBlocks, type PublicContentBlock } from "./content-blocks";
import { resolvePublicImage } from "./media";
import { DUMMY_SERVICE_IMAGES, dummyImage } from "../media/dummy-images";

export type PublicProductListItem = Readonly<{
  entityId: string;
  slug: string;
  title: string;
  summary: string;
  badge: string | null;
  priceLabel: string | null;
  image: ResolvedPublicMedia;
}>;

export async function listPublishedProducts(locale: ContentLocale): Promise<PublicProductListItem[]> {
  const entities = await prisma.contentEntity.findMany({
    where: { contentType: PRODUCT_CONTENT_TYPE, archived: false },
    select: { id: true },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  });

  const projections = await Promise.all(
    entities.map(async ({ id }, index): Promise<PublicProductListItem | null> => {
      const result = await resolve(prisma, { entityId: id, contentType: PRODUCT_CONTENT_TYPE, requestedLocale: locale });
      if (result.emptyReason !== null || result.payload === null || result.servedLocale === null) return null;

      const routes = await getPublishedRouteCandidates(prisma, id);
      const servedRoute = routes.find((route) => route.locale === result.servedLocale);
      if (!servedRoute) return null;

      const payload = result.payload as unknown as ProductPayload;
      const image = await resolvePublicImage(payload.imageAssetId, dummyImage(DUMMY_SERVICE_IMAGES, index));
      return {
        entityId: id,
        slug: servedRoute.slug,
        title: payload.title,
        summary: payload.summary,
        badge: payload.badge,
        priceLabel: payload.priceLabel,
        image,
      };
    }),
  );

  return projections.filter((item): item is PublicProductListItem => item !== null);
}

export type PublicProductDetail = PublicProductListItem &
  Readonly<{
    blocks: readonly PublicContentBlock[];
    gallery: readonly ResolvedPublicMedia[];
    ctaUrl: string | null;
    seoTitle: string | null;
    seoDescription: string | null;
    canonicalUrl: string;
    noindex: boolean;
  }>;

export async function getPublishedProductByRoute(locale: ContentLocale, slug: string): Promise<PublicProductDetail | null> {
  const native = await findPublishedProductByRoute(prisma, locale, PRODUCT_COLLECTION_SEGMENTS[locale], slug);
  const found =
    native ?? (locale === "tr" ? null : await findPublishedProductByRoute(prisma, "tr", PRODUCT_COLLECTION_SEGMENTS.tr, slug));
  if (!found) return null;

  const result = await resolve(prisma, { entityId: found.entityId, contentType: PRODUCT_CONTENT_TYPE, requestedLocale: locale });
  if (result.emptyReason !== null || result.payload === null || result.servedLocale === null) return null;

  const routes = await getPublishedRouteCandidates(prisma, found.entityId);
  const routeResolution = resolvePublicRoute(found.entityId, locale, routes);
  if (routeResolution.kind === "notFound") return null;

  // Stale alias (Story 6.2 AC-6.2-04): see service.ts's identical comment.
  if (!native && routeResolution.kind === "native") return null;

  const servedRoute = routes.find((route) => route.locale === result.servedLocale);
  if (!servedRoute) return null;

  const payload = result.payload as unknown as ProductPayload;
  const [image, gallery, blocks] = await Promise.all([
    resolvePublicImage(payload.imageAssetId, DUMMY_SERVICE_IMAGES[0]),
    Promise.all(payload.galleryAssetIds.map((assetId) => resolvePublicImage(assetId))),
    resolvePublicContentBlocks(payload.blocks),
  ]);

  return {
    entityId: found.entityId,
    slug: servedRoute.slug,
    title: payload.title,
    summary: payload.summary,
    badge: payload.badge,
    priceLabel: payload.priceLabel,
    image,
    gallery,
    ctaUrl: payload.ctaUrl,
    blocks,
    seoTitle: payload.seoTitle,
    seoDescription: payload.seoDescription,
    canonicalUrl: routeResolution.kind === "fallback" ? routeResolution.canonical : routeResolution.url,
    noindex: routeResolution.kind === "fallback" ? routeResolution.noindex : false,
  };
}

export async function getProductAlternates(entityId: string): Promise<Readonly<Partial<Record<ContentLocale, string>>>> {
  const routes = await getPublishedRouteCandidates(prisma, entityId);
  const alternates: Partial<Record<ContentLocale, string>> = {};
  for (const route of routes) alternates[route.locale] = generateRoute(route);
  return alternates;
}
