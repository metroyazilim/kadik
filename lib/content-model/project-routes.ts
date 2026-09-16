import type { RouteCandidate } from "./route-registry";
import { type ContentLocale } from "@prisma/client";
import { PROJECT_CONTENT_TYPE } from "./payload-validation";

export const PROJECT_COLLECTION_SEGMENTS: Readonly<Record<ContentLocale, string>> = {
  tr: "projeler",
  en: "projects",
};

export function projectRouteCandidate(locale: ContentLocale, slug: string): RouteCandidate {
  return {
    contentType: PROJECT_CONTENT_TYPE,
    locale,
    collectionSegment: PROJECT_COLLECTION_SEGMENTS[locale],
    slug: slug.trim().normalize("NFC").toLowerCase(),
  };
}
