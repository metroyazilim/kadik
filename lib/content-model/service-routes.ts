import type { RouteCandidate } from "./route-registry";
import { type ContentLocale } from "@prisma/client";

export const SERVICE_COLLECTION_SEGMENTS: Readonly<Record<ContentLocale, string>> = {
  tr: "servisler",
  en: "services",
};

/**
  * Generates a normalized route candidate for a service translation.
  */
export function serviceRouteCandidate(locale: ContentLocale, slug: string): RouteCandidate {
  const collectionSegment = SERVICE_COLLECTION_SEGMENTS[locale];
  return {
    contentType: "service",
    locale,
    collectionSegment,
    slug: slug.trim().normalize("NFC").toLowerCase(),
  };
}
