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
import { PRODUCT_CONTENT_TYPE, PRODUCT_SCHEMA_VERSION, type ProductPayload } from "@/lib/content-model/payload-validation";
import { productRouteCandidate, PRODUCT_COLLECTION_SEGMENTS } from "@/lib/content-model/product-routes";
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

function revalidatePublicProductSurfaces(): void {
  revalidatePath("/manage/products");
  revalidatePath("/urunler");
  revalidatePath("/en/products");
}

export async function createProductAction(): Promise<void> {
  const context = await resolveAdminContext();
  const { entityId } = await createCollectionEntity(prisma, context, PRODUCT_CONTENT_TYPE);
  revalidatePath("/manage/products");
  redirect(`/manage/products/${entityId}`);
}

export type ProductEditViewData = Readonly<{
  view: EntityEditView;
  assetPreviews: Readonly<Record<string, MediaAssetPreview>>;
}>;

export async function getProductEditViewAction(entityId: string): Promise<ProductEditViewData | null> {
  await resolveAdminContext();
  const view = await getEntityEditView(prisma, entityId, PRODUCT_CONTENT_TYPE);
  if (!view) return null;

  const assetIds: (string | null | undefined)[] = [];
  for (const translation of Object.values(view.translations)) {
    const payload = (translation?.draftPayload ?? translation?.publishedPayload ?? null) as ProductPayload | null;
    if (!payload) continue;
    assetIds.push(payload.imageAssetId, ...payload.galleryAssetIds, ...collectBlockMediaAssetIds(payload.blocks));
  }
  const assetPreviews = await resolveMediaAssetPreviews(prisma, assetIds);
  return { view, assetPreviews };
}

export async function getProductDependencyReportAction(entityId: string): Promise<EntityDependencyReport> {
  await resolveAdminContext();
  return getEntityDependencyReport(prisma, entityId, PRODUCT_CONTENT_TYPE);
}

export async function saveProductDraftAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const context = await resolveAdminContext();
  const entityId = text(formData, "entityId");
  const localeValue = text(formData, "locale");
  if (!entityId || !isLocale(localeValue)) return { error: "Geçersiz istek." };
  const locale = localeValue as ContentLocale;

  try {
    const galleryAssetIds = formData.getAll("galleryAssetIds").filter((value): value is string => typeof value === "string" && value.length > 0);
    const payload: ProductPayload = {
      title: text(formData, "title"),
      slug: await resolveRecordSlug(prisma, entityId, locale, text(formData, "title")),
      summary: text(formData, "summary"),
      blocks: parseBlocks(formData, "blocks") as readonly ContentBlock[],
      imageAssetId: optionalText(formData, "imageAssetId"),
      galleryAssetIds,
      badge: optionalText(formData, "badge"),
      priceLabel: optionalText(formData, "priceLabel"),
      ctaUrl: optionalText(formData, "ctaUrl"),
      seoTitle: optionalText(formData, "seoTitle"),
      seoDescription: optionalText(formData, "seoDescription"),
    };

    const blockAssetIds = collectBlockMediaAssetIds(payload.blocks);
    await assertMediaAssetsExist(prisma, [payload.imageAssetId, ...payload.galleryAssetIds, ...blockAssetIds]);

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
      schemaVersion: PRODUCT_SCHEMA_VERSION,
      payload: payload as unknown as Prisma.InputJsonValue,
    });

    if (!result.ok) {
      return { error: `Bu dilde arada başka bir değişiklik kaydedilmiş (v${result.current.version}). Sayfayı yenileyip tekrar deneyin.` };
    }

    await syncFieldMediaUsage(prisma, { entityId, locale, surface: PRODUCT_CONTENT_TYPE, field: "image", assetIds: [payload.imageAssetId] });
    await syncFieldMediaUsage(prisma, { entityId, locale, surface: PRODUCT_CONTENT_TYPE, field: "gallery", assetIds: payload.galleryAssetIds });
    await syncFieldMediaUsage(prisma, { entityId, locale, surface: PRODUCT_CONTENT_TYPE, field: "blocks", assetIds: blockAssetIds });

    revalidatePath("/manage/products");
    revalidatePath(`/manage/products/${entityId}`);
    return { success: `${locale.toUpperCase()} kaydedildi.` };
  } catch (error) {
    if (error instanceof ContentModelError) return { error: error.message };
    return { error: "Ürün kaydedilemedi. Alanları kontrol edip tekrar deneyin." };
  }
}

export async function publishProductAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
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
      { candidate: productRouteCandidate(locale, slug) },
      {
        recorder: persistedOutboxRecorder,
        tags: [contentEntityTag(entityId), contentAvailabilityTag(entityId, locale), "product:collection", seoIndexTag()],
      },
    );

    if (!result.ok) {
      if ("routeConflict" in result && result.routeConflict) {
        return { error: `"${slug}" adresi bu dilde başka bir ürün tarafından kullanılıyor.` };
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
          collectionSegment: PRODUCT_COLLECTION_SEGMENTS[locale],
          turkishSlug: turkishRoute?.slug ?? null,
          newNativeSlug: slug,
          targetTranslationId: translationId,
          targetRevisionId: result.translation.publishedRevisionId,
        });
      } catch {
        // Swallowed intentionally - see comment above.
      }
    }

    revalidatePublicProductSurfaces();
    revalidatePath(`/manage/products/${entityId}`);
    return { success: `${locale.toUpperCase()} yayınlandı.` };
  } catch (error) {
    if (error instanceof ContentModelError) return { error: error.message };
    return { error: "Yayınlama başarısız oldu." };
  }
}

export async function archiveProductAction(
  entityId: string,
  input: { archived: boolean; acknowledgedImpact: boolean },
): Promise<ActionState> {
  const context = await resolveAdminContext();
  try {
    await archiveEntityWithDependencyCheck(prisma, context, entityId, PRODUCT_CONTENT_TYPE, input);
    revalidatePublicProductSurfaces();
    return { success: input.archived ? "Ürün arşivlendi." : "Ürün arşivden çıkarıldı." };
  } catch (error) {
    if (error instanceof ContentModelError) return { error: error.message };
    return { error: "İşlem tamamlanamadı." };
  }
}

export async function deleteProductAction(entityId: string): Promise<ActionState> {
  const context = await resolveAdminContext();
  try {
    await deleteEntityIfSafe(prisma, context, entityId, PRODUCT_CONTENT_TYPE);
    revalidatePublicProductSurfaces();
    return { success: "Ürün silindi." };
  } catch (error) {
    if (error instanceof ContentModelError) return { error: error.message };
    return { error: "Silme işlemi tamamlanamadı." };
  }
}

export async function reorderProductsAction(orderedIds: readonly string[]): Promise<void> {
  const context = await resolveAdminContext();
  await adminReorderEntities(prisma, context, { contentType: PRODUCT_CONTENT_TYPE, orderedIds });
  revalidatePath("/manage/products");
}

/** One-click "Kaydet ve yayınla": saves the draft, then publishes the very
 * revision that save produced. Any refusal from either half is returned as
 * is, so a failed publish never looks like a successful save. */
export async function saveAndPublishProductAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const saved = await saveProductDraftAction(_previous, formData);
  if (saved.error) return saved;

  const entityId = text(formData, "entityId");
  const localeValue = text(formData, "locale");
  if (!entityId || !isLocale(localeValue)) return { error: "Geçersiz istek." };

  const refreshed = await refreshEditorFormPointers(prisma, formData, entityId, localeValue as ContentLocale);
  return publishProductAction(_previous, refreshed);
}
