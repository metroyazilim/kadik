import type { RouteCandidate } from "./route-registry";
import { type ContentLocale } from "@prisma/client";
import { TEAM_MEMBER_CONTENT_TYPE } from "./payload-validation";

export const TEAM_COLLECTION_SEGMENTS: Readonly<Record<ContentLocale, string>> = {
  tr: "ekip",
  en: "team",
};

export function teamMemberRouteCandidate(locale: ContentLocale, slug: string): RouteCandidate {
  return {
    contentType: TEAM_MEMBER_CONTENT_TYPE,
    locale,
    collectionSegment: TEAM_COLLECTION_SEGMENTS[locale],
    slug: slug.trim().normalize("NFC").toLowerCase(),
  };
}
