"use server";

import { resolveRecordSlug } from "@/lib/content-model/record-slug";
import { refreshEditorFormPointers } from "@/lib/content-model/editor-form-pointers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ContentLocale, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { resolveAdminContext } from "@/lib/content-model/admin-context";
import { createCollectionEntity, ensureLocaleTranslation, getEntityEditView, type EntityEditView } from "@/lib/content-model/collection-admin";
import { adminSaveDraft, adminPublish } from "@/lib/content-model/admin-content-store";
import { adminReorderEntities } from "@/lib/content-model/entity-ordering";
import { archiveEntityWithDependencyCheck, deleteEntityIfSafe, getEntityDependencyReport, type EntityDependencyReport } from "@/lib/content-model/entity-dependency";
import { assertMediaAssetsExist, resolveMediaAssetPreviews, syncFieldMediaUsage, type MediaAssetPreview } from "@/lib/content-model/content-media";
import { collectBlockMediaAssetIds, type ContentBlock } from "@/lib/content-model/content-blocks";
import { SERVICE_CONTENT_TYPE, SERVICE_SCHEMA_VERSION, type ServicePayload } from "@/lib/content-model/payload-validation";
import { serviceRouteCandidate, SERVICE_COLLECTION_SEGMENTS } from "@/lib/content-model/service-routes";
import { getPublishedRouteCandidates } from "@/lib/content-model/route-reader";
import { recordFallbackToNativeRedirect } from "@/lib/content-model/public-seo-redirect";
import { persistedOutboxRecorder } from "@/lib/content-model/outbox-store";
import { contentAvailabilityTag, contentEntityTag, seoIndexTag } from "@/lib/content-model/cache-tags";
import { ContentModelError } from "@/lib/content-model/errors";
import { isLocale } from "@/lib/i18n/config";

type ActionState = { error?: string; success?: string };

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function optionalText(formData: FormData, name: string): string | null {
  const value = text(formData, name);
  return value.length > 0 ? value : null;
}

function parseBlocks(formData: FormData, name: string): unknown {
  const raw = formData.get(name);
  if (typeof raw !== "string" || raw.length === 0) return [];
  try {
    return JSON.parse(raw);
  } catch {
    throw new ContentModelError("invalidInput", `Field '${name}' is not valid JSON.`);
  }
}

function revalidatePublicServiceSurfaces(): void {
  revalidatePath("/manage/services");
  revalidatePath("/servisler");
  revalidatePath("/en/services");
}

/** Creates the entity and returns its id - the caller (`ServicesListView`, a client component) opens the drawer on this id itself; no server-side redirect (Story 3.1-3.5's drawer-only CRUD contract). */
export async function createServiceAction(): Promise<void> {
  const context = await resolveAdminContext();
  const { entityId } = await createCollectionEntity(prisma, context, SERVICE_CONTENT_TYPE);
  revalidatePath("/manage/services");
  redirect(`/manage/services/${entityId}`);
}

export type ServiceEditViewData = Readonly<{
  view: EntityEditView;
  assetPreviews: Readonly<Record<string, MediaAssetPreview>>;
}>;

/** Hydrates the whole drawer in one call - every locale's draft/published payload plus every `MediaAsset` preview any of those payloads (main image or block images) reference. The drawer switches locale tabs client-side against this one fetch; no per-tab round trip. */
export async function getServiceEditViewAction(entityId: string): Promise<ServiceEditViewData | null> {
  await resolveAdminContext();
  const view = await getEntityEditView(prisma, entityId, SERVICE_CONTENT_TYPE);
  if (!view) return null;

  const assetIds: (string | null | undefined)[] = [];
  for (const translation of Object.values(view.translations)) {
    const payload = (translation?.draftPayload ?? translation?.publishedPayload ?? null) as ServicePayload | null;
    if (!payload) continue;
    assetIds.push(payload.imageAssetId);
    assetIds.push(...collectBlockMediaAssetIds(payload.blocks));
  }
  const assetPreviews = await resolveMediaAssetPreviews(prisma, assetIds);
  return { view, assetPreviews };
}

export async function getServiceDependencyReportAction(entityId: string): Promise<EntityDependencyReport> {
  await resolveAdminContext();
  return getEntityDependencyReport(prisma, entityId, SERVICE_CONTENT_TYPE);
}

export async function saveServiceDraftAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const context = await resolveAdminContext();
  const entityId = text(formData, "entityId");
  const localeValue = text(formData, "locale");
  if (!entityId || !isLocale(localeValue)) return { error: "Geçersiz istek." };
  const locale = localeValue as ContentLocale;

  try {
    const payload: ServicePayload = {
      title: text(formData, "title"),
      slug: await resolveRecordSlug(prisma, entityId, locale, text(formData, "title")),
      summary: text(formData, "summary"),
      blocks: parseBlocks(formData, "blocks") as readonly ContentBlock[],
      icon: optionalText(formData, "icon"),
      imageAssetId: optionalText(formData, "imageAssetId"),
      seoTitle: optionalText(formData, "seoTitle"),
      seoDescription: optionalText(formData, "seoDescription"),
    };

    const referencedAssetIds = [payload.imageAssetId, ...collectBlockMediaAssetIds(payload.blocks)];
    await assertMediaAssetsExist(prisma, referencedAssetIds);

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
      schemaVersion: SERVICE_SCHEMA_VERSION,
      payload: payload as unknown as Prisma.InputJsonValue,
    });

    if (!result.ok) {
      return {
        error: `Bu dilde arada başka bir değişiklik kaydedilmiş (v${result.current.version}). Sayfayı yenileyip tekrar deneyin.`,
      };
    }

    await syncFieldMediaUsage(prisma, {
      entityId,
      locale,
      surface: SERVICE_CONTENT_TYPE,
      field: "blocks",
      assetIds: referencedAssetIds,
    });

    revalidatePath("/manage/services");
    return { success: `${locale.toUpperCase()} kaydedildi.` };
  } catch (error) {
    if (error instanceof ContentModelError) return { error: error.message };
    return { error: "Hizmet kaydedilemedi. Alanları kontrol edip tekrar deneyin." };
  }
}

export async function publishServiceAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const context = await resolveAdminContext();
  const entityId = text(formData, "entityId");
  const localeValue = text(formData, "locale");
  if (!entityId || !isLocale(localeValue)) return { error: "Geçersiz istek." };
  const locale = localeValue as ContentLocale;
  const translationId = text(formData, "translationId");
  const expectedVersion = Number(text(formData, "expectedVersion") || "0");
  const expectedDraftRevisionId = text(formData, "draftRevisionId");
  const slug = await resolveRecordSlug(prisma, entityId, locale, text(formData, "title"));

  if (!translationId || !expectedDraftRevisionId || !slug) {
    return { error: "Bu dilde kaydedilmiş içerik yok; önce Kaydet deyin." };
  }

  try {
    const routesBeforePublish = await getPublishedRouteCandidates(prisma, entityId);
    const hadPriorRoute = routesBeforePublish.some((route) => route.locale === locale);
    const turkishRoute = routesBeforePublish.find((route) => route.locale === "tr");

    const result = await adminPublish(
      prisma,
      context,
      { translationId, expectedVersion, expectedDraftRevisionId },
      { candidate: serviceRouteCandidate(locale, slug) },
      {
        recorder: persistedOutboxRecorder,
        tags: [contentEntityTag(entityId), contentAvailabilityTag(entityId, locale), "service:collection", seoIndexTag()],
      },
    );

    if (!result.ok) {
      if ("routeConflict" in result && result.routeConflict) {
        return { error: `"${slug}" adresi bu dilde başka bir hizmet tarafından kullanılıyor.` };
      }
      return { error: "Yayınlama sırasında çakışma oluştu. Sayfayı yenileyip tekrar deneyin." };
    }

    if (!hadPriorRoute && result.translation.publishedRevisionId) {
      // Best-effort bookkeeping for a legacy-alias redirect - the publish
      // itself already committed successfully above; a failure here must
      // never be reported as a failed publish or skip cache revalidation.
      try {
        await recordFallbackToNativeRedirect(prisma, {
          entityId,
          locale,
          collectionSegment: SERVICE_COLLECTION_SEGMENTS[locale],
          turkishSlug: turkishRoute?.slug ?? null,
          newNativeSlug: slug,
          targetTranslationId: translationId,
          targetRevisionId: result.translation.publishedRevisionId,
        });
      } catch {
        // Swallowed intentionally - see comment above.
      }
    }

    revalidatePath("/manage/services");
    revalidatePublicServiceSurfaces();
    return { success: `${locale.toUpperCase()} yayınlandı.` };
  } catch (error) {
    if (error instanceof ContentModelError) return { error: error.message };
    return { error: "Yayınlama başarısız oldu." };
  }
}

export async function archiveServiceAction(
  entityId: string,
  input: { archived: boolean; acknowledgedImpact: boolean },
): Promise<ActionState> {
  const context = await resolveAdminContext();
  try {
    await archiveEntityWithDependencyCheck(prisma, context, entityId, SERVICE_CONTENT_TYPE, input);
    revalidatePublicServiceSurfaces();
    return { success: input.archived ? "Hizmet arşivlendi." : "Hizmet arşivden çıkarıldı." };
  } catch (error) {
    if (error instanceof ContentModelError) return { error: error.message };
    return { error: "İşlem tamamlanamadı." };
  }
}

export async function deleteServiceAction(entityId: string): Promise<ActionState> {
  const context = await resolveAdminContext();
  try {
    await deleteEntityIfSafe(prisma, context, entityId, SERVICE_CONTENT_TYPE);
    revalidatePublicServiceSurfaces();
    return { success: "Hizmet silindi." };
  } catch (error) {
    if (error instanceof ContentModelError) return { error: error.message };
    return { error: "Silme işlemi tamamlanamadı." };
  }
}

export async function reorderServicesAction(orderedIds: readonly string[]): Promise<void> {
  const context = await resolveAdminContext();
  await adminReorderEntities(prisma, context, { contentType: SERVICE_CONTENT_TYPE, orderedIds });
  revalidatePath("/manage/services");
}

/** One-click "Kaydet ve yayınla": saves the draft, then publishes the very
 * revision that save produced. Any refusal from either half is returned as
 * is, so a failed publish never looks like a successful save. */
export async function saveAndPublishServiceAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const saved = await saveServiceDraftAction(_previous, formData);
  if (saved.error) return saved;

  const entityId = text(formData, "entityId");
  const localeValue = text(formData, "locale");
  if (!entityId || !isLocale(localeValue)) return { error: "Geçersiz istek." };

  const refreshed = await refreshEditorFormPointers(prisma, formData, entityId, localeValue as ContentLocale);
  return publishServiceAction(_previous, refreshed);
}
