import type { ContentLocale, Prisma } from "@prisma/client";
import type { HomeLayoutSectionEntry, HomeSectionKey } from "./home-section-registry";
import { validateHomeSectionPayload } from "./home-section-schemas";

export type HomeSectionProjectionInput = Readonly<{
  servedLocale: ContentLocale;
  servedRevisionId: string;
  payload: Prisma.JsonValue;
  schemaVersion: number;
  fallbackApplied: boolean;
  publishedAt: Date;
}>;

export type SectionProjectionMap = Readonly<
  Record<HomeSectionKey, HomeSectionProjectionInput | null>
>;

export type EmptyReason = "disabled" | "missing-content" | "invalid-payload";

export type ComposedHomeSection = Readonly<{
  /** Stable placement identity; present for addable layouts with duplicate section types. */
  id?: string;
  key: HomeSectionKey;
  position: number;
  servedLocale: ContentLocale;
  servedRevisionId: string;
  payload: Prisma.JsonValue;
  fallbackApplied: boolean;
}>;

export type OmittedHomeSection = Readonly<{
  key: HomeSectionKey;
  reason: EmptyReason;
}>;

export type HomeComposition = Readonly<{
  requestedLocale: ContentLocale;
  layoutRevisionId: string;
  registryVersion: number;
  sections: readonly ComposedHomeSection[];
  omittedSections: readonly OmittedHomeSection[];
  cacheDependencies: readonly string[];
}>;

export type ComposeHomeInput = Readonly<{
  layoutRevisionPayload: readonly HomeLayoutSectionEntry[];
  layoutRevisionId: string;
  sectionProjections: SectionProjectionMap;
  requestedLocale: ContentLocale;
  registryVersion: number;
}>;

function revalidateSectionPayload(
  key: HomeSectionKey,
  projection: HomeSectionProjectionInput,
): boolean {
  try {
    validateHomeSectionPayload(key, projection.schemaVersion, projection.payload);
    return true;
  } catch {
    return false;
  }
}

/**
 * PURE. Synchronous. No Prisma import anywhere in this module. No async/await.
 * Composes Home section layout and locale content projections deterministically (AC-2.3-01, AC-2.3-02).
 */
export function composeHome(input: ComposeHomeInput): HomeComposition {
  const sections: ComposedHomeSection[] = [];
  const omittedSections: OmittedHomeSection[] = [];
  const contentTags: string[] = [];

  // Iterate in the layout's OWN order, never HOME_SECTION_KEYS's fixed
  // declaration order (AC-2.3-01/02): Story 2.1's `reorderedPayload`
  // encodes the admin's chosen display order directly into this array, and
  // `validateHomeLayoutPayload` guarantees every stored payload is exactly
  // a full permutation of the 11 registry keys before it ever reaches this
  // function - iterating it directly is both correct and simpler than a
  // fixed-order lookup that would silently ignore every reorder.
  for (const { key, enabled } of input.layoutRevisionPayload) {
    if (!enabled) {
      omittedSections.push({ key, reason: "disabled" });
      continue;
    }

    const projection = input.sectionProjections[key];
    if (!projection) {
      omittedSections.push({ key, reason: "missing-content" });
      continue;
    }

    if (!revalidateSectionPayload(key, projection)) {
      omittedSections.push({ key, reason: "invalid-payload" });
      continue;
    }

    const position = sections.length;
    sections.push({
      key,
      position,
      servedLocale: projection.servedLocale,
      servedRevisionId: projection.servedRevisionId,
      payload: projection.payload,
      fallbackApplied: projection.fallbackApplied,
    });

    contentTags.push(`content:${projection.servedRevisionId}`);
  }

  const cacheDependencies = ["home:layout", ...contentTags];

  return {
    requestedLocale: input.requestedLocale,
    layoutRevisionId: input.layoutRevisionId,
    registryVersion: input.registryVersion,
    sections,
    omittedSections,
    cacheDependencies,
  };
}
