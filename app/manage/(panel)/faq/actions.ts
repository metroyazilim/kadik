"use server";

import { refreshEditorFormPointers } from "@/lib/content-model/editor-form-pointers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ContentLocale, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { resolveAdminContext } from "@/lib/content-model/admin-context";
import {
  createCollectionEntity,
  ensureLocaleTranslation,
  getEntityEditView,
  type EntityEditView,
} from "@/lib/content-model/collection-admin";
import { adminSaveDraft, adminPublish } from "@/lib/content-model/admin-content-store";
import { adminReorderEntities } from "@/lib/content-model/entity-ordering";
import {
  archiveEntityWithDependencyCheck,
  deleteEntityIfSafe,
  getEntityDependencyReport,
  type EntityDependencyReport,
} from "@/lib/content-model/entity-dependency";
import { FAQ_CONTENT_TYPE, FAQ_SCHEMA_VERSION, type FaqPayload } from "@/lib/content-model/payload-validation";
import { persistedOutboxRecorder } from "@/lib/content-model/outbox-store";
import { contentAvailabilityTag, contentEntityTag } from "@/lib/content-model/cache-tags";
import { ContentModelError } from "@/lib/content-model/errors";
import { isLocale } from "@/lib/i18n/config";

type ActionState = { error?: string; success?: string };

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function revalidatePublicFaqSurfaces(): void {
  revalidatePath("/manage/faq");
  for (const locale of ["tr", "en"] as const) {
    revalidatePath(`/${locale}/faq`);
    revalidatePath(`/${locale}/services`);
  }
}

export async function createFaqAction(): Promise<void> {
  const context = await resolveAdminContext();
  const { entityId } = await createCollectionEntity(prisma, context, FAQ_CONTENT_TYPE);
  revalidatePath("/manage/faq");
  redirect(`/manage/faq/${entityId}`);
}

export type FaqEditViewData = Readonly<{ view: EntityEditView }>;

export async function getFaqEditViewAction(entityId: string): Promise<FaqEditViewData | null> {
  await resolveAdminContext();
  const view = await getEntityEditView(prisma, entityId, FAQ_CONTENT_TYPE);
  return view ? { view } : null;
}

export async function getFaqDependencyReportAction(entityId: string): Promise<EntityDependencyReport> {
  await resolveAdminContext();
  return getEntityDependencyReport(prisma, entityId, FAQ_CONTENT_TYPE);
}

export async function saveFaqDraftAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const context = await resolveAdminContext();
  const entityId = text(formData, "entityId");
  const localeValue = text(formData, "locale");
  if (!entityId || !isLocale(localeValue)) return { error: "Geçersiz istek." };
  const locale = localeValue as ContentLocale;

  const payload: FaqPayload = {
    question: text(formData, "question"),
    answer: text(formData, "answer"),
  };

  try {
    let translationId = text(formData, "translationId");
    let expectedVersion = Number(text(formData, "expectedVersion") || "0");
    if (!translationId) {
      const ensured = await ensureLocaleTranslation(prisma, context, entityId, locale);
      translationId = ensured.translationId;
      expectedVersion = ensured.version;
    }

    const result = await adminSaveDraft(prisma, context, {
      translationId,
      expectedVersion,
      schemaVersion: FAQ_SCHEMA_VERSION,
      payload: payload as unknown as Prisma.InputJsonValue,
    });

    if (!result.ok) {
      return { error: `Bu dilde arada başka bir değişiklik kaydedilmiş (v${result.current.version}). Sayfayı yenileyip tekrar deneyin.` };
    }

    revalidatePath("/manage/faq");
    return { success: `${locale.toUpperCase()} kaydedildi.` };
  } catch (error) {
    if (error instanceof ContentModelError) return { error: error.message };
    return { error: "Soru kaydedilemedi. Alanları kontrol edip tekrar deneyin." };
  }
}

export async function publishFaqAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const context = await resolveAdminContext();
  const entityId = text(formData, "entityId");
  const localeValue = text(formData, "locale");
  if (!entityId || !isLocale(localeValue)) return { error: "Geçersiz istek." };
  const locale = localeValue as ContentLocale;
  const translationId = text(formData, "translationId");
  const expectedVersion = Number(text(formData, "expectedVersion") || "0");
  const expectedDraftRevisionId = text(formData, "draftRevisionId");

  if (!translationId || !expectedDraftRevisionId) {
    return { error: "Bu dilde kaydedilmiş içerik yok; önce Kaydet deyin." };
  }

  try {
    // FAQ has no per-item public route - publish with no route/outbox route
    // reservation, only the audit + pointer swap.
    const result = await adminPublish(
      prisma,
      context,
      { translationId, expectedVersion, expectedDraftRevisionId },
      undefined,
      {
        recorder: persistedOutboxRecorder,
        tags: [contentEntityTag(entityId), contentAvailabilityTag(entityId, locale), "faq:collection"],
      },
    );

    if (!result.ok) {
      return { error: "Yayınlama sırasında çakışma oluştu. Sayfayı yenileyip tekrar deneyin." };
    }

    revalidatePublicFaqSurfaces();
    return { success: `${locale.toUpperCase()} yayınlandı.` };
  } catch (error) {
    if (error instanceof ContentModelError) return { error: error.message };
    return { error: "Yayınlama başarısız oldu." };
  }
}

export async function archiveFaqAction(
  entityId: string,
  input: { archived: boolean; acknowledgedImpact: boolean },
): Promise<ActionState> {
  const context = await resolveAdminContext();
  try {
    await archiveEntityWithDependencyCheck(prisma, context, entityId, FAQ_CONTENT_TYPE, input);
    revalidatePublicFaqSurfaces();
    return { success: input.archived ? "Soru arşivlendi." : "Soru arşivden çıkarıldı." };
  } catch (error) {
    if (error instanceof ContentModelError) return { error: error.message };
    return { error: "İşlem tamamlanamadı." };
  }
}

export async function deleteFaqAction(entityId: string): Promise<ActionState> {
  const context = await resolveAdminContext();
  try {
    await deleteEntityIfSafe(prisma, context, entityId, FAQ_CONTENT_TYPE);
    revalidatePublicFaqSurfaces();
    return { success: "Soru silindi." };
  } catch (error) {
    if (error instanceof ContentModelError) return { error: error.message };
    return { error: "Silme işlemi tamamlanamadı." };
  }
}

export async function reorderFaqsAction(orderedIds: readonly string[]): Promise<void> {
  const context = await resolveAdminContext();
  await adminReorderEntities(prisma, context, { contentType: FAQ_CONTENT_TYPE, orderedIds });
  revalidatePath("/manage/faq");
}

/** One-click "Kaydet ve yayınla": saves the draft, then publishes the very
 * revision that save produced. Any refusal from either half is returned as
 * is, so a failed publish never looks like a successful save. */
export async function saveAndPublishFaqAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const saved = await saveFaqDraftAction(_previous, formData);
  if (saved.error) return saved;

  const entityId = text(formData, "entityId");
  const localeValue = text(formData, "locale");
  if (!entityId || !isLocale(localeValue)) return { error: "Geçersiz istek." };

  const refreshed = await refreshEditorFormPointers(prisma, formData, entityId, localeValue as ContentLocale);
  return publishFaqAction(_previous, refreshed);
}
