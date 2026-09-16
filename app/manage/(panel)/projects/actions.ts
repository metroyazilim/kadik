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
import { PROJECT_CONTENT_TYPE, PROJECT_SCHEMA_VERSION, type ProjectPayload } from "@/lib/content-model/payload-validation";
import { projectRouteCandidate, PROJECT_COLLECTION_SEGMENTS } from "@/lib/content-model/project-routes";
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

function revalidatePublicProjectSurfaces(): void {
  revalidatePath("/manage/projects");
  revalidatePath("/projeler");
  revalidatePath("/en/projects");
}

export async function createProjectAction(): Promise<void> {
  const context = await resolveAdminContext();
  const { entityId } = await createCollectionEntity(prisma, context, PROJECT_CONTENT_TYPE);
  revalidatePath("/manage/projects");
  redirect(`/manage/projects/${entityId}`);
}

export type ProjectEditViewData = Readonly<{
  view: EntityEditView;
  assetPreviews: Readonly<Record<string, MediaAssetPreview>>;
}>;

export async function getProjectEditViewAction(entityId: string): Promise<ProjectEditViewData | null> {
  await resolveAdminContext();
  const view = await getEntityEditView(prisma, entityId, PROJECT_CONTENT_TYPE);
  if (!view) return null;

  const assetIds: (string | null | undefined)[] = [];
  for (const translation of Object.values(view.translations)) {
    const payload = (translation?.draftPayload ?? translation?.publishedPayload ?? null) as ProjectPayload | null;
    if (!payload) continue;
    assetIds.push(
      payload.coverImageAssetId,
      ...payload.galleryAssetIds,
      ...collectBlockMediaAssetIds(payload.challengeBlocks),
      ...collectBlockMediaAssetIds(payload.solutionBlocks),
    );
  }
  const assetPreviews = await resolveMediaAssetPreviews(prisma, assetIds);
  return { view, assetPreviews };
}

export async function getProjectDependencyReportAction(entityId: string): Promise<EntityDependencyReport> {
  await resolveAdminContext();
  return getEntityDependencyReport(prisma, entityId, PROJECT_CONTENT_TYPE);
}

export async function saveProjectDraftAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const context = await resolveAdminContext();
  const entityId = text(formData, "entityId");
  const localeValue = text(formData, "locale");
  if (!entityId || !isLocale(localeValue)) return { error: "Geçersiz istek." };
  const locale = localeValue as ContentLocale;

  try {
    const galleryAssetIds = formData.getAll("galleryAssetIds").filter((value): value is string => typeof value === "string" && value.length > 0);
    const payload: ProjectPayload = {
      title: text(formData, "title"),
      slug: await resolveRecordSlug(prisma, entityId, locale, text(formData, "title")),
      category: text(formData, "category"),
      coverImageAssetId: optionalText(formData, "coverImageAssetId"),
      galleryAssetIds,
      challengeBlocks: parseBlocks(formData, "challengeBlocks") as readonly ContentBlock[],
      solutionBlocks: parseBlocks(formData, "solutionBlocks") as readonly ContentBlock[],
      client: optionalText(formData, "client"),
      seoTitle: optionalText(formData, "seoTitle"),
      seoDescription: optionalText(formData, "seoDescription"),
    };

    const challengeAssetIds = collectBlockMediaAssetIds(payload.challengeBlocks);
    const solutionAssetIds = collectBlockMediaAssetIds(payload.solutionBlocks);
    await assertMediaAssetsExist(prisma, [
      payload.coverImageAssetId,
      ...payload.galleryAssetIds,
      ...challengeAssetIds,
      ...solutionAssetIds,
    ]);

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
      schemaVersion: PROJECT_SCHEMA_VERSION,
      payload: payload as unknown as Prisma.InputJsonValue,
    });

    if (!result.ok) {
      return { error: `Bu dilde arada başka bir değişiklik kaydedilmiş (v${result.current.version}). Sayfayı yenileyip tekrar deneyin.` };
    }

    await syncFieldMediaUsage(prisma, { entityId, locale, surface: PROJECT_CONTENT_TYPE, field: "coverImage", assetIds: [payload.coverImageAssetId] });
    await syncFieldMediaUsage(prisma, { entityId, locale, surface: PROJECT_CONTENT_TYPE, field: "gallery", assetIds: payload.galleryAssetIds });
    await syncFieldMediaUsage(prisma, { entityId, locale, surface: PROJECT_CONTENT_TYPE, field: "challengeBlocks", assetIds: challengeAssetIds });
    await syncFieldMediaUsage(prisma, { entityId, locale, surface: PROJECT_CONTENT_TYPE, field: "solutionBlocks", assetIds: solutionAssetIds });

    revalidatePath("/manage/projects");
    return { success: `${locale.toUpperCase()} kaydedildi.` };
  } catch (error) {
    if (error instanceof ContentModelError) return { error: error.message };
    return { error: "Proje kaydedilemedi. Alanları kontrol edip tekrar deneyin." };
  }
}

export async function publishProjectAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
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
      { candidate: projectRouteCandidate(locale, slug) },
      {
        recorder: persistedOutboxRecorder,
        tags: [contentEntityTag(entityId), contentAvailabilityTag(entityId, locale), "project:collection", seoIndexTag()],
      },
    );

    if (!result.ok) {
      if ("routeConflict" in result && result.routeConflict) {
        return { error: `"${slug}" adresi bu dilde başka bir proje tarafından kullanılıyor.` };
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
          collectionSegment: PROJECT_COLLECTION_SEGMENTS[locale],
          turkishSlug: turkishRoute?.slug ?? null,
          newNativeSlug: slug,
          targetTranslationId: translationId,
          targetRevisionId: result.translation.publishedRevisionId,
        });
      } catch {
        // Swallowed intentionally - see comment above.
      }
    }

    revalidatePublicProjectSurfaces();
    return { success: `${locale.toUpperCase()} yayınlandı.` };
  } catch (error) {
    if (error instanceof ContentModelError) return { error: error.message };
    return { error: "Yayınlama başarısız oldu." };
  }
}

export async function archiveProjectAction(
  entityId: string,
  input: { archived: boolean; acknowledgedImpact: boolean },
): Promise<ActionState> {
  const context = await resolveAdminContext();
  try {
    await archiveEntityWithDependencyCheck(prisma, context, entityId, PROJECT_CONTENT_TYPE, input);
    revalidatePublicProjectSurfaces();
    return { success: input.archived ? "Proje arşivlendi." : "Proje arşivden çıkarıldı." };
  } catch (error) {
    if (error instanceof ContentModelError) return { error: error.message };
    return { error: "İşlem tamamlanamadı." };
  }
}

export async function deleteProjectAction(entityId: string): Promise<ActionState> {
  const context = await resolveAdminContext();
  try {
    await deleteEntityIfSafe(prisma, context, entityId, PROJECT_CONTENT_TYPE);
    revalidatePublicProjectSurfaces();
    return { success: "Proje silindi." };
  } catch (error) {
    if (error instanceof ContentModelError) return { error: error.message };
    return { error: "Silme işlemi tamamlanamadı." };
  }
}

export async function reorderProjectsAction(orderedIds: readonly string[]): Promise<void> {
  const context = await resolveAdminContext();
  await adminReorderEntities(prisma, context, { contentType: PROJECT_CONTENT_TYPE, orderedIds });
  revalidatePath("/manage/projects");
}

/** One-click "Kaydet ve yayınla": saves the draft, then publishes the very
 * revision that save produced. Any refusal from either half is returned as
 * is, so a failed publish never looks like a successful save. */
export async function saveAndPublishProjectAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const saved = await saveProjectDraftAction(_previous, formData);
  if (saved.error) return saved;

  const entityId = text(formData, "entityId");
  const localeValue = text(formData, "locale");
  if (!entityId || !isLocale(localeValue)) return { error: "Geçersiz istek." };

  const refreshed = await refreshEditorFormPointers(prisma, formData, entityId, localeValue as ContentLocale);
  return publishProjectAction(_previous, refreshed);
}
