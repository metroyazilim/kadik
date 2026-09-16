import "server-only";

import type { ContentLocale, PrismaClient } from "@prisma/client";
import { slugifyTitle } from "./slugify";

/**
 * One address per record, derived from the Turkish title.
 *
 * Turkish is the source locale, and the public URL already carries the
 * locale (`/en/team/<slug>`), so every translation reuses the Turkish slug
 * instead of deriving its own. That is not just a nicety: a Cyrillic or
 * Arabic title slugifies to an empty string, which would fail payload
 * validation and make those locales unsavable.
 *
 * Editing the Turkish record still re-derives the slug from its own title,
 * so renaming a record in the source locale moves its address as before.
 */
export async function resolveRecordSlug(
  client: PrismaClient,
  entityId: string,
  locale: ContentLocale,
  titleForSlug: string,
): Promise<string> {
  const derived = slugifyTitle(titleForSlug);
  if (locale === "tr") return derived;

  const turkish = await client.contentTranslation.findUnique({
    where: { entityId_locale: { entityId, locale: "tr" } },
    include: { publishedRevision: true, draftRevision: true },
  });
  const turkishPayload = (turkish?.publishedRevision?.payload ??
    turkish?.draftRevision?.payload ??
    null) as { slug?: unknown } | null;

  return typeof turkishPayload?.slug === "string" && turkishPayload.slug.length > 0
    ? turkishPayload.slug
    : derived;
}
