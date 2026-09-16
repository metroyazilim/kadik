import "server-only";
import type { ContentLocale } from "@prisma/client";
import { prisma } from "../db";
import { resolve } from "../content-model/public-content-reader";
import { getPublishedRouteCandidates } from "../content-model/route-reader";
import { generateRoute, resolvePublicRoute } from "../content-model/route-registry";
import { findPublishedTeamMemberByRoute } from "../content-model/team-route-lookup";
import { TEAM_COLLECTION_SEGMENTS } from "../content-model/team-routes";
import { TEAM_MEMBER_CONTENT_TYPE, type TeamMemberPayload } from "../content-model/payload-validation";
import type { ResolvedPublicMedia } from "../content-model/public-media-resolver";
import { resolvePublicImage } from "./media";
import { DUMMY_TEAM_IMAGES, dummyImage } from "../media/dummy-images";

export type TeamMemberSocialLinks = Readonly<{ instagram: string | null; linkedin: string | null }>;

export type PublicTeamMemberListItem = Readonly<{
  entityId: string;
  slug: string;
  name: string;
  role: string;
  image: ResolvedPublicMedia;
  social: TeamMemberSocialLinks;
}>;

export async function listPublishedTeamMembers(locale: ContentLocale): Promise<PublicTeamMemberListItem[]> {
  const entities = await prisma.contentEntity.findMany({
    where: { contentType: TEAM_MEMBER_CONTENT_TYPE, archived: false },
    select: { id: true },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  });

  const projections = await Promise.all(
    entities.map(async ({ id }, index): Promise<PublicTeamMemberListItem | null> => {
      const result = await resolve(prisma, { entityId: id, contentType: TEAM_MEMBER_CONTENT_TYPE, requestedLocale: locale });
      if (result.emptyReason !== null || result.payload === null || result.servedLocale === null) return null;

      const routes = await getPublishedRouteCandidates(prisma, id);
      const servedRoute = routes.find((route) => route.locale === result.servedLocale);
      if (!servedRoute) return null;

      const payload = result.payload as unknown as TeamMemberPayload;
      const image = await resolvePublicImage(payload.imageAssetId, dummyImage(DUMMY_TEAM_IMAGES, index));
      return {
        entityId: id,
        slug: servedRoute.slug,
        name: payload.name,
        role: payload.role,
        image,
        social: {
          instagram: payload.social?.instagram ?? null,
          linkedin: payload.social?.linkedin ?? null,
        },
      };
    }),
  );

  return projections.filter((item): item is PublicTeamMemberListItem => item !== null);
}

export type PublicTeamMemberDetail = PublicTeamMemberListItem &
  Readonly<{
    email: string | null;
    phone: string | null;
    bio: string;
    seoTitle: string | null;
    seoDescription: string | null;
    canonicalUrl: string;
    noindex: boolean;
  }>;

export async function getPublishedTeamMemberByRoute(locale: ContentLocale, slug: string): Promise<PublicTeamMemberDetail | null> {
  const native = await findPublishedTeamMemberByRoute(prisma, locale, TEAM_COLLECTION_SEGMENTS[locale], slug);
  const found =
    native ?? (locale === "tr" ? null : await findPublishedTeamMemberByRoute(prisma, "tr", TEAM_COLLECTION_SEGMENTS.tr, slug));
  if (!found) return null;

  const result = await resolve(prisma, { entityId: found.entityId, contentType: TEAM_MEMBER_CONTENT_TYPE, requestedLocale: locale });
  if (result.emptyReason !== null || result.payload === null || result.servedLocale === null) return null;

  const routes = await getPublishedRouteCandidates(prisma, found.entityId);
  const routeResolution = resolvePublicRoute(found.entityId, locale, routes);
  if (routeResolution.kind === "notFound") return null;

  // Stale alias (Story 6.2 AC-6.2-04): see service.ts's identical comment.
  if (!native && routeResolution.kind === "native") return null;

  const servedRoute = routes.find((route) => route.locale === result.servedLocale);
  if (!servedRoute) return null;

  const payload = result.payload as unknown as TeamMemberPayload;
  const image = await resolvePublicImage(payload.imageAssetId, DUMMY_TEAM_IMAGES[0]);

  return {
    entityId: found.entityId,
    slug: servedRoute.slug,
    name: payload.name,
    role: payload.role,
    image,
    email: payload.email,
    phone: payload.phone,
    social: {
      instagram: payload.social?.instagram ?? null,
      linkedin: payload.social?.linkedin ?? null,
    },
    bio: payload.bio,
    seoTitle: payload.seoTitle,
    seoDescription: payload.seoDescription,
    canonicalUrl: routeResolution.kind === "fallback" ? routeResolution.canonical : routeResolution.url,
    noindex: routeResolution.kind === "fallback" ? routeResolution.noindex : false,
  };
}

export async function getTeamMemberAlternates(entityId: string): Promise<Readonly<Partial<Record<ContentLocale, string>>>> {
  const routes = await getPublishedRouteCandidates(prisma, entityId);
  const alternates: Partial<Record<ContentLocale, string>> = {};
  for (const route of routes) alternates[route.locale] = generateRoute(route);
  return alternates;
}
