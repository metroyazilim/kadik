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
import { POST_CONTENT_TYPE, POST_SCHEMA_VERSION, type PostPayload } from "@/lib/content-model/payload-validation";
import { postRouteCandidate, POST_COLLECTION_SEGMENTS } from "@/lib/content-model/post-routes";
import { getPublishedRouteCandidates } from "@/lib/content-model/route-reader";
import { recordFallbackToNativeRedirect } from "@/lib/content-model/public-seo-redirect";
import { persistedOutboxRecorder } from "@/lib/content-model/outbox-store";
import { contentAvailabilityTag, contentEntityTag, seoIndexTag } from "@/lib/content-model/cache-tags";
import { ContentModelError } from "@/lib/content-model/errors";
import { ADMIN_CONTENT_LOCALE, isLocale } from "@/lib/i18n/config";

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

function revalidatePublicPostSurfaces(): void {
  revalidatePath("/manage/posts");
  revalidatePath("/blog");
  revalidatePath("/en/blog");
}

/** Creates the entity for `/manage/posts/new`; that route redirects directly to the record's full-page editor. */
export async function createPostAction(): Promise<void> {
  const context = await resolveAdminContext();
  const { entityId } = await createCollectionEntity(prisma, context, POST_CONTENT_TYPE);
  revalidatePath("/manage/posts");
  redirect(`/manage/posts/${entityId}`);
}

export type PostEditViewData = Readonly<{
  view: EntityEditView;
  assetPreviews: Readonly<Record<string, MediaAssetPreview>>;
}>;

export async function getPostEditViewAction(entityId: string): Promise<PostEditViewData | null> {
  await resolveAdminContext();
  const view = await getEntityEditView(prisma, entityId, POST_CONTENT_TYPE);
  if (!view) return null;

  const assetIds: (string | null | undefined)[] = [];
  for (const translation of Object.values(view.translations)) {
    const payload = (translation?.draftPayload ?? translation?.publishedPayload ?? null) as PostPayload | null;
    if (!payload) continue;
    assetIds.push(payload.coverImageAssetId);
    assetIds.push(...collectBlockMediaAssetIds(payload.blocks));
  }
  const assetPreviews = await resolveMediaAssetPreviews(prisma, assetIds);
  return { view, assetPreviews };
}

export async function getPostDependencyReportAction(entityId: string): Promise<EntityDependencyReport> {
  await resolveAdminContext();
  return getEntityDependencyReport(prisma, entityId, POST_CONTENT_TYPE);
}

export async function savePostDraftAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const context = await resolveAdminContext();
  const entityId = text(formData, "entityId");
  const localeValue = text(formData, "locale");
  if (!entityId || !isLocale(localeValue)) return { error: "Geçersiz istek." };
  const locale = localeValue as ContentLocale;

  try {
    const payload: PostPayload = {
      title: text(formData, "title"),
      slug: await resolveRecordSlug(prisma, entityId, locale, text(formData, "title")),
      excerpt: text(formData, "excerpt"),
      blocks: parseBlocks(formData, "blocks") as readonly ContentBlock[],
      category: text(formData, "category"),
      author: text(formData, "author"),
      coverImageAssetId: optionalText(formData, "coverImageAssetId"),
      seoTitle: optionalText(formData, "seoTitle"),
      seoDescription: optionalText(formData, "seoDescription"),
    };

    const referencedAssetIds = [payload.coverImageAssetId, ...collectBlockMediaAssetIds(payload.blocks)];
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
      schemaVersion: POST_SCHEMA_VERSION,
      payload: payload as unknown as Prisma.InputJsonValue,
    });

    if (!result.ok) {
      return {
        error: `Bu kayıt siz düzenlerken başka biri tarafından değiştirildi. Sayfayı yenileyip tekrar deneyin.`,
      };
    }

    await syncFieldMediaUsage(prisma, {
      entityId,
      locale,
      surface: POST_CONTENT_TYPE,
      field: "blocks",
      assetIds: referencedAssetIds,
    });

    revalidatePath("/manage/posts");
    return { success: "Kaydedildi." };
  } catch (error) {
    if (error instanceof ContentModelError) return { error: error.message };
    return { error: "Gönderi kaydedilemedi. Alanları kontrol edip tekrar deneyin." };
  }
}

export async function publishPostAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
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
    return { error: "Kaydedilecek içerik bulunamadı. Sayfayı yenileyip tekrar deneyin." };
  }

  try {
    const routesBeforePublish = await getPublishedRouteCandidates(prisma, entityId);
    const hadPriorRoute = routesBeforePublish.some((route) => route.locale === locale);
    const turkishRoute = routesBeforePublish.find((route) => route.locale === "tr");

    const result = await adminPublish(
      prisma,
      context,
      { translationId, expectedVersion, expectedDraftRevisionId },
      { candidate: postRouteCandidate(locale, slug) },
      {
        recorder: persistedOutboxRecorder,
        tags: [contentEntityTag(entityId), contentAvailabilityTag(entityId, locale), "post:collection", seoIndexTag()],
      },
    );

    if (!result.ok) {
      if ("routeConflict" in result && result.routeConflict) {
        return { error: `"${slug}" adresi başka bir gönderi tarafından kullanılıyor.` };
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
          collectionSegment: POST_COLLECTION_SEGMENTS[locale],
          turkishSlug: turkishRoute?.slug ?? null,
          newNativeSlug: slug,
          targetTranslationId: translationId,
          targetRevisionId: result.translation.publishedRevisionId,
        });
      } catch {
        // Swallowed intentionally - see comment above.
      }
    }

    revalidatePath("/manage/posts");
    revalidatePublicPostSurfaces();
    return { success: "Kaydedildi ve sitede yayınlandı." };
  } catch (error) {
    if (error instanceof ContentModelError) return { error: error.message };
    return { error: "Yayınlama başarısız oldu." };
  }
}

export async function archivePostAction(
  entityId: string,
  input: { archived: boolean; acknowledgedImpact: boolean },
): Promise<ActionState> {
  const context = await resolveAdminContext();
  try {
    await archiveEntityWithDependencyCheck(prisma, context, entityId, POST_CONTENT_TYPE, input);
    revalidatePublicPostSurfaces();
    return { success: input.archived ? "Gönderi arşivlendi." : "Gönderi arşivden çıkarıldı." };
  } catch (error) {
    if (error instanceof ContentModelError) return { error: error.message };
    return { error: "İşlem tamamlanamadı." };
  }
}

export async function deletePostAction(entityId: string): Promise<ActionState> {
  const context = await resolveAdminContext();
  try {
    await deleteEntityIfSafe(prisma, context, entityId, POST_CONTENT_TYPE);
    revalidatePublicPostSurfaces();
    return { success: "Gönderi silindi." };
  } catch (error) {
    if (error instanceof ContentModelError) return { error: error.message };
    return { error: "Silme işlemi tamamlanamadı." };
  }
}

export async function reorderPostsAction(orderedIds: readonly string[]): Promise<void> {
  const context = await resolveAdminContext();
  await adminReorderEntities(prisma, context, { contentType: POST_CONTENT_TYPE, orderedIds });
  revalidatePath("/manage/posts");
}

/** One-click "Kaydet ve yayınla": saves the draft, then publishes the very
 * revision that save produced. Any refusal from either half is returned as
 * is, so a failed publish never looks like a successful save. */
export async function saveAndPublishPostAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const saved = await savePostDraftAction(_previous, formData);
  if (saved.error) return saved;

  const entityId = text(formData, "entityId");
  const localeValue = text(formData, "locale");
  if (!entityId || !isLocale(localeValue)) return { error: "Geçersiz istek." };

  const refreshed = await refreshEditorFormPointers(prisma, formData, entityId, localeValue as ContentLocale);
  return publishPostAction(_previous, refreshed);
}

/**
 * Used by the SEO screen: rewrites only `seoTitle`/`seoDescription` of the
 * post's current content and publishes it through the same save+publish
 * path as the editor, so validation, routes and cache tags stay identical.
 */
export async function savePostSeoAction(
  entityId: string,
  seo: { title: string; description: string },
): Promise<{ ok: boolean; message: string }> {
  await resolveAdminContext();
  const view = await getEntityEditView(prisma, entityId, POST_CONTENT_TYPE);
  const translation = view?.translations[ADMIN_CONTENT_LOCALE];
  const payload = (translation?.draftPayload ?? translation?.publishedPayload ?? null) as PostPayload | null;
  if (!translation || !payload) return { ok: false, message: "Haber bulunamadı ya da henüz kaydedilmemiş." };

  const form = new FormData();
  form.set("entityId", entityId);
  form.set("locale", ADMIN_CONTENT_LOCALE);
  form.set("translationId", translation.translationId);
  form.set("expectedVersion", String(translation.version));
  form.set("draftRevisionId", translation.draftRevisionId ?? "");
  form.set("title", payload.title);
  form.set("excerpt", payload.excerpt);
  form.set("blocks", JSON.stringify(payload.blocks ?? []));
  form.set("category", payload.category);
  form.set("author", payload.author);
  form.set("coverImageAssetId", payload.coverImageAssetId ?? "");
  form.set("seoTitle", seo.title.trim().slice(0, 70));
  form.set("seoDescription", seo.description.trim().slice(0, 160));

  const result = await saveAndPublishPostAction({}, form);
  revalidatePath("/manage/seo");
  revalidatePath("/news", "layout");
  return result.error ? { ok: false, message: result.error } : { ok: true, message: `"${payload.title}" SEO ayarları kaydedildi.` };
}
