import type { RouteCandidate } from "./route-registry";
import { type ContentLocale } from "@prisma/client";
import { POST_CONTENT_TYPE } from "./payload-validation";

/** Turkish and Global English intentionally share the naturalized `blog` segment. */
export const POST_COLLECTION_SEGMENTS: Readonly<Record<ContentLocale, string>> = {
  tr: "blog",
  en: "blog",
};

export function postRouteCandidate(locale: ContentLocale, slug: string): RouteCandidate {
  return {
    contentType: POST_CONTENT_TYPE,
    locale,
    collectionSegment: POST_COLLECTION_SEGMENTS[locale],
    slug: slug.trim().normalize("NFC").toLowerCase(),
  };
}
