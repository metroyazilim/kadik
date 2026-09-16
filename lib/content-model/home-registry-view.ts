import type { ContentLocale, HomeSectionKey, PrismaClient } from "@prisma/client";
import { HOME_SECTION_KEYS, HOME_SECTION_LABELS, defaultHomeLayoutPayload } from "./home-section-registry";
import { getHomeLayoutWorkingState, type HomeLayoutSnapshot } from "./home-layout";
import { validateHomeLayoutPayload, type HomeLayoutSectionEntry } from "./home-section-registry";

const LOCALES = ["tr", "en"] as const satisfies readonly ContentLocale[];

export type HomeSectionLocaleStatus = "missing" | "draft" | "published";

export type HomeSectionRegistryRow = Readonly<{
  key: HomeSectionKey;
  label: string;
  order: number;
  enabled: boolean;
  entityId: string;
  changedSincePublished: boolean;
  localeStatus: Readonly<Record<ContentLocale, HomeSectionLocaleStatus>>;
}>;

export type HomeLayoutAdminView = Readonly<{
  layoutId: string | null;
  version: number;
  draftRevisionId: string | null;
  publishedRevisionId: string | null;
  isDraftPending: boolean;
  sections: readonly HomeSectionRegistryRow[];
}>;

function localeStatusFor(translation: {
  draftRevisionId: string | null;
  publishedRevisionId: string | null;
} | null): HomeSectionLocaleStatus {
  if (!translation) return "missing";
  if (translation.publishedRevisionId) return "published";
  if (translation.draftRevisionId) return "draft";
  return "missing";
}

/**
 * Reads the current published layout payload (for the "changed since
 * published" diff) without throwing when no `HomeLayoutRevision` has ever
 * been published yet (a layout row can exist in a not-yet-published state
 * only transiently, before `ensureHomeSectionRegistry()`'s baseline publish
 * runs).
 */
function publishedPayloadOf(
  layout: (HomeLayoutSnapshot & { publishedRevision: { schemaVersion: number; payload: unknown } | null }) | null,
): readonly HomeLayoutSectionEntry[] | null {
  if (!layout?.publishedRevisionId) return null;
  const revision = layout.publishedRevision;
  if (!revision) return null;
  return validateHomeLayoutPayload(revision.schemaVersion, revision.payload);
}

/**
 * Story 2.1's admin read model (AC-2.1-01/06): the working (draft-preferred)
 * layout order/visibility, each section's registry metadata, and its
 * per-locale content status - all derived at read time from
 * `HomeLayout`/`HomeLayoutRevision`/`HomeSection`/`ContentTranslation`,
 * with no extra "what changed" column stored anywhere.
 */
export async function getHomeLayoutAdminView(client: PrismaClient): Promise<HomeLayoutAdminView> {
  const [{ layout, payload }, sections] = await Promise.all([
    getHomeLayoutWorkingState(client),
    client.homeSection.findMany({
      include: { entity: { include: { translations: true } } },
    }),
  ]);

  const layoutWithPublished = layout
    ? await client.homeLayout.findUnique({
        where: { id: layout.id },
        include: { publishedRevision: true },
      })
    : null;
  const publishedPayload = publishedPayloadOf(layoutWithPublished);
  const publishedEnabledByKey = new Map(
    (publishedPayload ?? []).map((entry, index) => [entry.key, { enabled: entry.enabled, order: index }]),
  );

  const sectionByKey = new Map(sections.map((section) => [section.key, section]));

  const workingOrder = payload.length > 0 ? payload : defaultHomeLayoutPayload();
  const rows: HomeSectionRegistryRow[] = workingOrder.map((entry, order) => {
    const section = sectionByKey.get(entry.key);
    const label = HOME_SECTION_LABELS[entry.key];
    if (!section) {
      // Registry bootstrap has not run yet for this key - report a
      // placeholder row rather than throwing, so the admin page can still
      // render a "run the bootstrap" state instead of a hard error.
      return {
        key: entry.key,
        label,
        order,
        enabled: entry.enabled,
        entityId: "",
        changedSincePublished: true,
        localeStatus: { tr: "missing", en: "missing" },
      };
    }
    const translationsByLocale = new Map(
      section.entity.translations.map((translation) => [translation.locale, translation]),
    );
    const localeStatus = Object.fromEntries(
      LOCALES.map((locale) => [locale, localeStatusFor(translationsByLocale.get(locale) ?? null)]),
    ) as Record<ContentLocale, HomeSectionLocaleStatus>;

    const publishedEntry = publishedEnabledByKey.get(entry.key);
    const changedSincePublished =
      !publishedEntry || publishedEntry.enabled !== entry.enabled || publishedEntry.order !== order;

    return {
      key: entry.key,
      label,
      order,
      enabled: entry.enabled,
      entityId: section.entityId,
      changedSincePublished,
      localeStatus,
    };
  });

  return {
    layoutId: layout?.id ?? null,
    version: layout?.version ?? 0,
    draftRevisionId: layout?.draftRevisionId ?? null,
    publishedRevisionId: layout?.publishedRevisionId ?? null,
    isDraftPending: Boolean(layout && layout.draftRevisionId !== layout.publishedRevisionId),
    sections: rows,
  };
}

/** Re-exported for callers that only need the fixed key list, not the view. */
export { HOME_SECTION_KEYS };
