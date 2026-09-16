import type { ContentLocale, PrismaClient } from "@prisma/client";
import { assertAdminContext, type AdminContext } from "./admin-context";
import { ContentModelError } from "./errors";
import {
  HOME_SECTION_LABELS,
  isHomeSectionKey,
  type HomeSectionKey,
  type HomeSectionLocaleStatus,
} from "./home-section-registry";
import {
  defaultHomeSectionPayload,
  validateHomeSectionPayload,
  type HomeSectionPayloadMap,
} from "./home-section-schemas";

export type HomeSectionEditorView<K extends HomeSectionKey = HomeSectionKey> = Readonly<{
  key: K;
  label: string;
  locale: ContentLocale;
  translationId: string;
  entityId: string;
  version: number;
  status: HomeSectionLocaleStatus;
  isDraftPending: boolean;
  publishedAt: Date | null;
  draftSavedAt: Date | null;
  payload: HomeSectionPayloadMap[K];
  localeStatuses: Readonly<Record<ContentLocale, HomeSectionLocaleStatus>>;
}>;

function determineLocaleStatus(
  draftId: string | null,
  publishedId: string | null,
): HomeSectionLocaleStatus {
  if (publishedId !== null) return "published";
  if (draftId !== null) return "draft";
  return "missing";
}

/**
 * Resolves the complete editor view model for a Home section in a given locale.
 * Reusable across Server Component page render and Server Action responses.
 */
export async function adminGetHomeSectionEditorView<K extends HomeSectionKey>(
  client: PrismaClient,
  context: AdminContext,
  key: K,
  locale: ContentLocale,
): Promise<HomeSectionEditorView<K>> {
  assertAdminContext(context);

  if (!isHomeSectionKey(key)) {
    throw new ContentModelError("invalidInput", `Unknown Home section key: '${key}'`);
  }

  const section = await client.homeSection.findUnique({
    where: { key },
    include: {
      entity: {
        include: {
          translations: {
            include: {
              draftRevision: true,
              publishedRevision: true,
            },
          },
        },
      },
    },
  });

  if (!section) {
    throw new ContentModelError(
      "notFound",
      `Home section '${key}' is not bootstrapped in the registry.`,
    );
  }

  const localeStatuses: Record<ContentLocale, HomeSectionLocaleStatus> = {
    tr: "missing",
    en: "missing",
  };

  let targetTranslation: (typeof section.entity.translations)[number] | undefined;

  for (const trans of section.entity.translations) {
    localeStatuses[trans.locale] = determineLocaleStatus(
      trans.draftRevisionId,
      trans.publishedRevisionId,
    );
    if (trans.locale === locale) {
      targetTranslation = trans;
    }
  }

  if (!targetTranslation) {
    throw new ContentModelError(
      "notFound",
      `Translation for Home section '${key}' in locale '${locale}' was not found.`,
    );
  }

  const status = localeStatuses[locale];
  const isDraftPending =
    targetTranslation.draftRevisionId !== null &&
    targetTranslation.draftRevisionId !== targetTranslation.publishedRevisionId;

  let activePayload: HomeSectionPayloadMap[K];
  let draftSavedAt: Date | null = null;

  if (targetTranslation.draftRevision) {
    draftSavedAt = targetTranslation.draftRevision.createdAt;
    try {
      activePayload = validateHomeSectionPayload(
        key,
        targetTranslation.draftRevision.schemaVersion,
        targetTranslation.draftRevision.payload,
      );
    } catch {
      activePayload = defaultHomeSectionPayload(key);
    }
  } else if (targetTranslation.publishedRevision) {
    try {
      activePayload = validateHomeSectionPayload(
        key,
        targetTranslation.publishedRevision.schemaVersion,
        targetTranslation.publishedRevision.payload,
      );
    } catch {
      activePayload = defaultHomeSectionPayload(key);
    }
  } else {
    activePayload = defaultHomeSectionPayload(key);
  }

  const label = HOME_SECTION_LABELS[key] ?? key;

  return {
    key,
    label,
    locale,
    translationId: targetTranslation.id,
    entityId: section.entityId,
    version: targetTranslation.version,
    status,
    isDraftPending,
    publishedAt: targetTranslation.publishedAt,
    draftSavedAt,
    payload: activePayload,
    localeStatuses,
  };
}
