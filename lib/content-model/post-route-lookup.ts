import type { PrismaClient, ContentLocale } from "@prisma/client";
import { getPublishedRouteCandidates } from "./route-reader";
import { resolvePublicRoute } from "./route-registry";
import { POST_CONTENT_TYPE } from "./payload-validation";

/** Published-route-to-entity reverse lookup for Blog, mirroring `service-route-lookup.ts`/`team-route-lookup.ts` exactly: only a route whose translation is actually published (and whose full route set still resolves through `resolvePublicRoute`) ever returns an entity id. */
export async function findPublishedPostByRoute(
  client: PrismaClient,
  locale: ContentLocale,
  collectionSegment: string,
  slug: string,
): Promise<Readonly<{ entityId: string }> | null> {
  const routes = await client.contentRoute.findMany({
    where: {
      contentType: POST_CONTENT_TYPE,
      locale,
      collectionSegment,
      slug,
      translation: { publishedRevisionId: { not: null } },
    },
    select: { entityId: true },
  });
  if (routes.length === 0) return null;

  const candidate = routes[0];
  const publishedRoutes = await getPublishedRouteCandidates(client, candidate.entityId);
  const resolved = resolvePublicRoute(candidate.entityId, locale, publishedRoutes);
  if (resolved.kind === "notFound") return null;
  return { entityId: candidate.entityId };
}
