import type { ContentLocale, PrismaClient } from "@prisma/client";
import { getPublished } from "./public-content-reader";
import {
  HOME_SECTION_KEYS,
  defaultHomeLayoutPayload,
  validateHomeLayoutPayload,
} from "./home-section-registry";
import { composeHome, type HomeComposition, type SectionProjectionMap } from "./home-composer";
import type { HomeLayoutSectionEntry } from "./home-section-registry";

export type ResolveHomeProjectionInput = Readonly<{
  requestedLocale: ContentLocale;
  revisionSource: "draft" | "published";
}>;

export type HomeProjectionResult = Readonly<{
  layoutRevisionId: string;
  layoutRevisionPayload: readonly HomeLayoutSectionEntry[];
  registryVersion: number;
  sectionProjections: SectionProjectionMap;
}>;

/**
 * Resolves the real inputs composeHome needs from the database (CAP-3).
 * Queries published content with locale fallback (native -> tr) and reads layout revisions.
 */
export async function resolveHomeProjection(
  client: PrismaClient,
  input: ResolveHomeProjectionInput,
): Promise<HomeProjectionResult> {
  const layoutRow = await client.homeLayout.findUnique({
    where: { singleton: true },
    include: { publishedRevision: true },
  });
  // Public reads only the PUBLISHED layout revision; an unpublished reorder
  // draft must never change the live section order.
  const publishedLayout = layoutRow?.publishedRevision;
  let layoutRevisionPayload = defaultHomeLayoutPayload();
  if (publishedLayout) {
    try {
      layoutRevisionPayload = validateHomeLayoutPayload(
        publishedLayout.schemaVersion,
        publishedLayout.payload,
      );
    } catch {
      layoutRevisionPayload = defaultHomeLayoutPayload();
    }
  }
  const layoutRevisionId = layoutRow?.publishedRevisionId ?? "fixed-home-components-v1";
  const registryVersion = 1;

  const sectionProjectionsMap: Record<string, import("./home-composer").HomeSectionProjectionInput | null> = {};

  for (const key of HOME_SECTION_KEYS) {
    const section = await client.homeSection.findUnique({
      where: { key },
      select: { entityId: true },
    });

    if (!section) {
      sectionProjectionsMap[key] = null;
      continue;
    }

    const entityId = section.entityId;

    let published = await getPublished(client, {
      entityId,
      locale: input.requestedLocale,
    });

    let fallbackApplied = false;
    let servedLocale: ContentLocale = input.requestedLocale;

    if (!published && input.requestedLocale !== "tr") {
      published = await getPublished(client, {
        entityId,
        locale: "tr",
      });
      if (published) {
        fallbackApplied = true;
        servedLocale = "tr";
      }
    }

    if (!published) {
      sectionProjectionsMap[key] = null;
    } else {
      sectionProjectionsMap[key] = {
        servedLocale,
        servedRevisionId: published.publishedRevisionId,
        payload: published.payload,
        schemaVersion: published.schemaVersion,
        fallbackApplied,
        publishedAt: published.publishedAt,
      };
    }
  }

  return {
    layoutRevisionId,
    layoutRevisionPayload,
    registryVersion,
    sectionProjections: sectionProjectionsMap as SectionProjectionMap,
  };
}

/**
 * Thin composition helper: calls resolveHomeProjection then composeHome.
 */
export async function composeHomeFromDatabase(
  client: PrismaClient,
  input: ResolveHomeProjectionInput,
): Promise<HomeComposition> {
  const projection = await resolveHomeProjection(client, input);
  return composeHome({
    layoutRevisionPayload: projection.layoutRevisionPayload,
    layoutRevisionId: projection.layoutRevisionId,
    sectionProjections: projection.sectionProjections,
    requestedLocale: input.requestedLocale,
    registryVersion: projection.registryVersion,
  });
}
