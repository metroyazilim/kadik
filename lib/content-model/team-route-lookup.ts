import type { PrismaClient, ContentLocale } from "@prisma/client";
import { getPublishedRouteCandidates } from "./route-reader";
import { resolvePublicRoute } from "./route-registry";
import { TEAM_MEMBER_CONTENT_TYPE } from "./payload-validation";

export async function findPublishedTeamMemberByRoute(
  client: PrismaClient,
  locale: ContentLocale,
  collectionSegment: string,
  slug: string,
): Promise<Readonly<{ entityId: string }> | null> {
  const routes = await client.contentRoute.findMany({
    where: {
      contentType: TEAM_MEMBER_CONTENT_TYPE,
      locale,
      collectionSegment,
      slug,
      translation: { publishedRevisionId: { not: null } },
    },
    select: { entityId: true, locale: true, collectionSegment: true, slug: true },
  });
  if (routes.length === 0) return null;

  const candidate = routes[0];
  const publishedRoutes = await getPublishedRouteCandidates(client, candidate.entityId);
  const resolved = resolvePublicRoute(candidate.entityId, locale, publishedRoutes);
  if (resolved.kind === "notFound") return null;
  return { entityId: candidate.entityId };
}
