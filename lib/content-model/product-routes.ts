import type { RouteCandidate } from "./route-registry";
import { type ContentLocale } from "@prisma/client";
import { PRODUCT_CONTENT_TYPE } from "./payload-validation";

export const PRODUCT_COLLECTION_SEGMENTS: Readonly<Record<ContentLocale, string>> = {
  tr: "urunler",
  en: "products",
};

export function productRouteCandidate(locale: ContentLocale, slug: string): RouteCandidate {
  return {
    contentType: PRODUCT_CONTENT_TYPE,
    locale,
    collectionSegment: PRODUCT_COLLECTION_SEGMENTS[locale],
    slug: slug.trim().normalize("NFC").toLowerCase(),
  };
}
