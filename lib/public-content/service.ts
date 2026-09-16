import "server-only";
import type { ContentLocale } from "@prisma/client";
import { prisma } from "../db";
import { resolve } from "../content-model/public-content-reader";
import { getPublishedRouteCandidates } from "../content-model/route-reader";
import { generateRoute, resolvePublicRoute } from "../content-model/route-registry";
import { findPublishedEntityByRoute } from "../content-model/service-route-lookup";
import { SERVICE_COLLECTION_SEGMENTS } from "../content-model/service-routes";
import {
  SERVICE_CONTENT_TYPE,
  type ServicePayload,
} from "../content-model/payload-validation";
import type { ResolvedPublicMedia } from "../content-model/public-media-resolver";
import { resolvePublicContentBlocks, type PublicContentBlock } from "./content-blocks";
import { resolvePublicImage } from "./media";
import { DUMMY_SERVICE_IMAGES, dummyImage } from "../media/dummy-images";

export type PublicServiceListItem = Readonly<{
  entityId: string;
  slug: string;
  title: string;
  summary: string;
  icon: string | null;
  image: ResolvedPublicMedia;
}>;

/**
 * Lists only entities with a published requested-locale or Turkish fallback
 * projection and links each item with the route of the locale actually served.
 */
export async function listPublishedServices(locale: ContentLocale): Promise<PublicServiceListItem[]> {
  const entities = await prisma.contentEntity.findMany({
    where: { contentType: SERVICE_CONTENT_TYPE, archived: false },
    select: { id: true },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  });

  const projections = await Promise.all(
    entities.map(async ({ id }, index): Promise<PublicServiceListItem | null> => {
      const result = await resolve(prisma, {
        entityId: id,
        contentType: SERVICE_CONTENT_TYPE,
        requestedLocale: locale,
      });
      if (result.emptyReason !== null || result.payload === null || result.servedLocale === null) {
        return null;
      }

      const routes = await getPublishedRouteCandidates(prisma, id);
      const servedRoute = routes.find((route) => route.locale === result.servedLocale);
      if (!servedRoute) return null;

      const payload = result.payload as unknown as ServicePayload;
      const image = await resolvePublicImage(payload.imageAssetId, dummyImage(DUMMY_SERVICE_IMAGES, index));
      return {
        entityId: id,
        slug: servedRoute.slug,
        title: payload.title,
        summary: payload.summary,
        icon: payload.icon,
        image,
      };
    }),
  );

  return projections.filter((item): item is PublicServiceListItem => item !== null);
}

export type PublicServiceDetail = PublicServiceListItem &
  Readonly<{
    blocks: readonly PublicContentBlock[];
    seoTitle: string | null;
    seoDescription: string | null;
    canonicalUrl: string;
    noindex: boolean;
    /** True when `requestedLocale` had no published translation and this
     * is the Turkish source content served as a safe fallback (AC-3.1-04) -
     * every locale detail page uses this to render a visible fallback
     * notice instead of silently substituting content. */
    isFallback: boolean;
  }>;

/**
 * Resolves the incoming native route first, then permits the same raw slug to
 * identify a published Turkish source route for a locale fallback view.
 */
export async function getPublishedServiceByRoute(
  locale: ContentLocale,
  slug: string,
): Promise<PublicServiceDetail | null> {
  const native = await findPublishedEntityByRoute(
    prisma,
    locale,
    SERVICE_COLLECTION_SEGMENTS[locale],
    slug,
  );
  const found =
    native ??
    (locale === "tr"
      ? null
      : await findPublishedEntityByRoute(
          prisma,
          "tr",
          SERVICE_COLLECTION_SEGMENTS.tr,
          slug,
        ));
  if (!found) return null;

  const result = await resolve(prisma, {
    entityId: found.entityId,
    contentType: SERVICE_CONTENT_TYPE,
    requestedLocale: locale,
  });
  if (result.emptyReason !== null || result.payload === null || result.servedLocale === null) {
    return null;
  }

  const routes = await getPublishedRouteCandidates(prisma, found.entityId);
  const routeResolution = resolvePublicRoute(found.entityId, locale, routes);
  if (routeResolution.kind === "notFound") return null;

  // Stale alias (Story 6.2 AC-6.2-04): this request only matched via the
  // Turkish-raw-slug fallback path (native was null), but the entity now
  // has its own native route for this locale at a different slug -
  // resolvePublicRoute would silently resolve "native" here and render 200
  // with a corrected canonical instead of letting the caller's not-found
  // branch 301 the stale address. Never serve it directly.
  if (!native && routeResolution.kind === "native") return null;

  const servedRoute = routes.find((route) => route.locale === result.servedLocale);
  if (!servedRoute) return null;

  const payload = result.payload as unknown as ServicePayload;
  const [image, blocks] = await Promise.all([
    resolvePublicImage(payload.imageAssetId, DUMMY_SERVICE_IMAGES[0]),
    resolvePublicContentBlocks(payload.blocks),
  ]);
  return {
    entityId: found.entityId,
    slug: servedRoute.slug,
    title: payload.title,
    summary: payload.summary,
    icon: payload.icon,
    image,
    blocks,
    seoTitle: payload.seoTitle,
    seoDescription: payload.seoDescription,
    canonicalUrl:
      routeResolution.kind === "fallback"
        ? routeResolution.canonical
        : routeResolution.url,
    noindex: routeResolution.kind === "fallback" ? routeResolution.noindex : false,
    isFallback: routeResolution.kind === "fallback",
  };
}

/** Returns hreflang candidates only for locales with an actual published route. */
export async function getServiceAlternates(
  entityId: string,
): Promise<Readonly<Partial<Record<ContentLocale, string>>>> {
  const routes = await getPublishedRouteCandidates(prisma, entityId);
  const alternates: Partial<Record<ContentLocale, string>> = {};
  for (const route of routes) {
    alternates[route.locale] = generateRoute(route);
  }
  return alternates;
}
