"use server";

import { revalidatePath } from "next/cache";
import type { ContentLocale, HomeSectionKey, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { resolveAdminContext } from "@/lib/content-model/admin-context";
import { adminSaveDraft, adminPublish } from "@/lib/content-model/admin-content-store";
import { assertMediaAssetsExist } from "@/lib/content-model/content-media";
import {
  adminGetHomeLayoutView,
  adminSetHomeSectionVisibility,
  adminPublishHomeLayout,
  adminReorderHomeSections,
} from "@/lib/content-model/home-admin-store";
import {
  HOME_SECTION_SCHEMA_VERSION,
  homeSectionMediaAssetIds,
  validateHomeSectionPayload,
  type HomeWidgetConfig,
} from "@/lib/content-model/home-section-schemas";

export type HomeAccordionActionState = Readonly<{
  status: "idle" | "success" | "error";
  message: string;
}>;

export async function saveHomeSectionDirectAction(
  sectionKey: HomeSectionKey,
  locale: ContentLocale,
  blocks: readonly Record<string, unknown>[],
  widget?: HomeWidgetConfig,
  /** `false` keeps the section unpublished - the "Kaydet" button - while the
   * default publishes in the same call, matching "Kaydet ve yayınla". */
  publish = true,
): Promise<HomeAccordionActionState> {
  try {
    const context = await resolveAdminContext();
    const section = await prisma.homeSection.findUnique({
      where: { key: sectionKey },
      include: {
        entity: {
          include: {
            translations: { where: { locale } },
          },
        },
      },
    });
    if (!section) {
      return { status: "error", message: "Anasayfa bölümü bulunamadı." };
    }

    const storedWidget = widget?.bgImageAssetId ? { ...widget, bgImage: null } : widget;
    const validated = validateHomeSectionPayload(
      sectionKey,
      HOME_SECTION_SCHEMA_VERSION,
      { blocks, widget: storedWidget ?? {} },
    );
    await assertMediaAssetsExist(prisma, homeSectionMediaAssetIds(validated));

    const translation = section.entity.translations[0];
    if (!translation) {
      return { status: "error", message: `${locale.toUpperCase()} çevirisi bulunamadı.` };
    }

    const saved = await adminSaveDraft(prisma, context, {
      translationId: translation.id,
      expectedVersion: translation.version,
      schemaVersion: HOME_SECTION_SCHEMA_VERSION,
      payload: validated as unknown as Prisma.InputJsonValue,
    });
    if (!saved.ok) {
      return { status: "error", message: "Çakışma: içerik başka bir sekmede güncellendi." };
    }

    if (!publish) {
      revalidatePath("/manage/home");
      return { status: "success", message: "Kaydedildi." };
    }

    const published = await adminPublish(prisma, context, {
      translationId: translation.id,
      expectedVersion: saved.translation.version,
      expectedDraftRevisionId: saved.revisionId,
    });
    if (!published.ok) {
      return { status: "error", message: "Kaydedildi ancak yayına alınamadı; sayfayı yenileyip tekrar deneyin." };
    }

    revalidatePath("/manage/home");
    revalidatePath("/manage/pages/home");
    revalidatePath("/", "layout");
    return { status: "success", message: "Kaydedildi ve yayına alındı." };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Kaydedilemedi.",
    };
  }
}

/**
 * Persists the admin's drag-and-drop Home section order. Reads the current
 * layout version for the optimistic-concurrency check, writes the reorder
 * draft, then publishes it in the same call so the public homepage reflects
 * the new order immediately - matching the accordion's save-and-publish
 * contract for section content.
 */
export async function reorderHomeSectionsAction(
  orderedKeys: readonly HomeSectionKey[],
): Promise<HomeAccordionActionState> {
  try {
    const context = await resolveAdminContext();
    const view = await adminGetHomeLayoutView(prisma, context);

    const saved = await adminReorderHomeSections(prisma, context, {
      expectedVersion: view.version,
      orderedKeys,
    });
    if (!saved.ok) {
      return { status: "error", message: "Çakışma: sıralama başka bir sekmede güncellendi." };
    }

    const published = await adminPublishHomeLayout(prisma, context, {
      expectedVersion: saved.layout.version,
      expectedDraftRevisionId: saved.revisionId,
    });
    if (!published.ok) {
      return { status: "error", message: "Sıra kaydedildi ancak yayına alınamadı; sayfayı yenileyin." };
    }

    revalidatePath("/manage/home");
    revalidatePath("/", "layout");
    return { status: "success", message: "Bölüm sırası kaydedildi ve yayına alındı." };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Sıralama kaydedilemedi.",
    };
  }
}

/**
 * Eye / eye-slash on a section: flips its `enabled` flag in the Home layout
 * and publishes the layout in the same call, so hiding a section removes it
 * from the live page immediately (the composer skips disabled entries).
 */
export async function setHomeSectionVisibilityAction(
  key: HomeSectionKey,
  enabled: boolean,
): Promise<HomeAccordionActionState> {
  try {
    const context = await resolveAdminContext();
    const view = await adminGetHomeLayoutView(prisma, context);

    const saved = await adminSetHomeSectionVisibility(prisma, context, {
      expectedVersion: view.version,
      key,
      enabled,
    });
    if (!saved.ok) {
      return { status: "error", message: "Çakışma: düzen başka bir sekmede güncellendi." };
    }

    const published = await adminPublishHomeLayout(prisma, context, {
      expectedVersion: saved.layout.version,
      expectedDraftRevisionId: saved.revisionId,
    });
    if (!published.ok) {
      return { status: "error", message: "Görünürlük kaydedildi ancak yayına alınamadı; sayfayı yenileyin." };
    }

    revalidatePath("/manage/home");
    revalidatePath("/", "layout");
    return { status: "success", message: enabled ? "Bölüm gösteriliyor." : "Bölüm gizlendi." };
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Görünürlük değiştirilemedi." };
  }
}

/**
 * Whole-homepage translation, not one section at a time: exports the
 * Turkish payload of every section keyed by its registry key, so a single
 * prompt covers the entire page and a single paste writes all of it back.
 */
export async function exportHomeTranslationSourceAction(): Promise<
  Readonly<{ status: "success"; source: Record<string, unknown> }> | HomeAccordionActionState
> {
  try {
    await resolveAdminContext();
    const sections = await prisma.homeSection.findMany({
      include: {
        entity: {
          include: { translations: { where: { locale: "tr" }, include: { draftRevision: true, publishedRevision: true } } },
        },
      },
    });

    const source: Record<string, unknown> = {};
    for (const section of sections) {
      const translation = section.entity.translations[0];
      const revision = translation?.draftRevision ?? translation?.publishedRevision;
      if (!revision) continue;
      source[section.key] = revision.payload;
    }
    return { status: "success", source };
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Anasayfa içeriği okunamadı." };
  }
}

/**
 * Applies one bundle of `{ locale: { sectionKey: payload } }` across every
 * section. Each section is validated with its own schema and written as an
 * unpublished revision, so a bad machine translation never reaches the live
 * homepage; a single invalid section aborts before anything is written.
 */
export async function importHomeTranslationsAction(
  translations: Record<string, unknown>,
): Promise<HomeAccordionActionState> {
  try {
    const context = await resolveAdminContext();
    const sections = await prisma.homeSection.findMany({ include: { entity: true } });
    const entityByKey = new Map(sections.map((section) => [section.key as string, section.entityId]));

    type PendingWrite = Readonly<{ locale: ContentLocale; entityId: string; key: HomeSectionKey; payload: unknown }>;
    const pending: PendingWrite[] = [];

    for (const [locale, perSection] of Object.entries(translations)) {
      if (locale !== "en" || !perSection || typeof perSection !== "object") continue;
      for (const [key, payload] of Object.entries(perSection as Record<string, unknown>)) {
        const entityId = entityByKey.get(key);
        if (!entityId || !payload || typeof payload !== "object") continue;
        const validated = validateHomeSectionPayload(key as HomeSectionKey, HOME_SECTION_SCHEMA_VERSION, payload);
        pending.push({ locale: "en", entityId, key: key as HomeSectionKey, payload: validated });
      }
    }

    if (pending.length === 0) {
      return { status: "error", message: "Çeviri bulunamadı; JSON `en` altında bölüm anahtarları içermeli." };
    }

    for (const item of pending) {
      let translation = await prisma.contentTranslation.findUnique({
        where: { entityId_locale: { entityId: item.entityId, locale: item.locale } },
      });
      if (!translation) {
        translation = await prisma.contentTranslation.create({
          data: { entityId: item.entityId, locale: item.locale },
        });
      }
      const saved = await adminSaveDraft(prisma, context, {
        translationId: translation.id,
        expectedVersion: translation.version,
        schemaVersion: HOME_SECTION_SCHEMA_VERSION,
        payload: item.payload as Prisma.InputJsonValue,
      });
      if (!saved.ok) {
        return { status: "error", message: `${item.key} (${item.locale.toUpperCase()}) kaydedilemedi: çakışma.` };
      }

      // Home sections have no per-record route, so publishing is just the
      // pointer move - imported copy goes live with the paste, like the
      // rest of the translation flows.
      const published = await adminPublish(prisma, context, {
        translationId: translation.id,
        expectedVersion: saved.translation.version,
        expectedDraftRevisionId: saved.revisionId,
      });
      if (!published.ok) {
        return { status: "error", message: `${item.key} (${item.locale.toUpperCase()}) yayına alınamadı.` };
      }
    }

    revalidatePath("/manage/home");
    revalidatePath("/", "layout");
    return { status: "success", message: `${pending.length} bölüm çevirisi kaydedildi ve yayına alındı.` };
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Çeviriler kaydedilemedi." };
  }
}
