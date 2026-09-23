"use server";

import { resolveRecordSlug } from "@/lib/content-model/record-slug";
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
import {
  assertMediaAssetsExist,
  resolveMediaAssetPreviews,
  syncFieldMediaUsage,
  type MediaAssetPreview,
} from "@/lib/content-model/content-media";
import {
  TEAM_MEMBER_CONTENT_TYPE,
  TEAM_MEMBER_SCHEMA_VERSION,
  type TeamMemberPayload,

} from "@/lib/content-model/payload-validation";
import { teamMemberRouteCandidate, TEAM_COLLECTION_SEGMENTS } from "@/lib/content-model/team-routes";
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

function revalidatePublicTeamSurfaces(): void {
  revalidatePath("/manage/team");
  revalidatePath("/ekip", "layout");
  revalidatePath("/en/team", "layout");
}

export async function createTeamMemberAction(): Promise<void> {
  const context = await resolveAdminContext();
  const { entityId } = await createCollectionEntity(prisma, context, TEAM_MEMBER_CONTENT_TYPE);
  revalidatePath("/manage/team");
  redirect(`/manage/team/${entityId}`);
}

export type TeamMemberEditViewData = Readonly<{
  view: EntityEditView;
  assetPreviews: Readonly<Record<string, MediaAssetPreview>>;
}>;

export async function getTeamMemberEditViewAction(entityId: string): Promise<TeamMemberEditViewData | null> {
  await resolveAdminContext();
  const view = await getEntityEditView(prisma, entityId, TEAM_MEMBER_CONTENT_TYPE);
  if (!view) return null;

  const assetIds: (string | null | undefined)[] = [];
  for (const translation of Object.values(view.translations)) {
    const payload = (translation?.draftPayload ?? translation?.publishedPayload ?? null) as TeamMemberPayload | null;
    if (payload) assetIds.push(payload.imageAssetId);
  }
  const assetPreviews = await resolveMediaAssetPreviews(prisma, assetIds);
  return { view, assetPreviews };
}

export async function getTeamMemberDependencyReportAction(entityId: string): Promise<EntityDependencyReport> {
  await resolveAdminContext();
  return getEntityDependencyReport(prisma, entityId, TEAM_MEMBER_CONTENT_TYPE);
}

export async function saveTeamMemberDraftAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const context = await resolveAdminContext();
  const entityId = text(formData, "entityId");
  const localeValue = text(formData, "locale");
  if (!entityId || !isLocale(localeValue)) return { error: "Geçersiz istek." };
  const locale = localeValue as ContentLocale;

  const instagram = optionalText(formData, "instagram");
  const linkedin = optionalText(formData, "linkedin");

  const payload: TeamMemberPayload = {
    name: text(formData, "name"),
    slug: await resolveRecordSlug(prisma, entityId, locale, text(formData, "name")),
    role: text(formData, "role"),
    imageAssetId: optionalText(formData, "imageAssetId"),
    email: optionalText(formData, "email"),
    phone: optionalText(formData, "phone"),
    social: instagram || linkedin ? { instagram, linkedin } : null,
    bio: text(formData, "bio"),
    seoTitle: optionalText(formData, "seoTitle"),
    seoDescription: optionalText(formData, "seoDescription"),
  };


  try {
    await assertMediaAssetsExist(prisma, [payload.imageAssetId]);

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
      schemaVersion: TEAM_MEMBER_SCHEMA_VERSION,
      payload: payload as unknown as Prisma.InputJsonValue,
    });

    if (!result.ok) {
      return { error: `Bu kayıt siz düzenlerken başka biri tarafından değiştirildi. Sayfayı yenileyip tekrar deneyin.` };
    }

    await syncFieldMediaUsage(prisma, {
      entityId,
      locale,
      surface: TEAM_MEMBER_CONTENT_TYPE,
      field: "image",
      assetIds: [payload.imageAssetId],
    });

    revalidatePath("/manage/team");
    return { success: "Kaydedildi." };
  } catch (error) {
    if (error instanceof ContentModelError) return { error: error.message };
    return { error: "Kurul üyesi kaydedilemedi. Alanları kontrol edip tekrar deneyin." };
  }
}

export async function publishTeamMemberAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const context = await resolveAdminContext();
  const entityId = text(formData, "entityId");
  const localeValue = text(formData, "locale");
  if (!entityId || !isLocale(localeValue)) return { error: "Geçersiz istek." };
  const locale = localeValue as ContentLocale;
  const translationId = text(formData, "translationId");
  const expectedVersion = Number(text(formData, "expectedVersion") || "0");
  const expectedDraftRevisionId = text(formData, "draftRevisionId");
  const slug = await resolveRecordSlug(prisma, entityId, locale, text(formData, "name"));

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
      { candidate: teamMemberRouteCandidate(locale, slug) },
      {
        recorder: persistedOutboxRecorder,
        tags: [contentEntityTag(entityId), contentAvailabilityTag(entityId, locale), "team-member:collection", seoIndexTag()],
      },
    );

    if (!result.ok) {
      if ("routeConflict" in result && result.routeConflict) {
        return { error: `"${slug}" adresi başka bir kurul üyesi tarafından kullanılıyor.` };
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
          collectionSegment: TEAM_COLLECTION_SEGMENTS[locale],
          turkishSlug: turkishRoute?.slug ?? null,
          newNativeSlug: slug,
          targetTranslationId: translationId,
          targetRevisionId: result.translation.publishedRevisionId,
        });
      } catch {
        // Swallowed intentionally - see comment above.
      }
    }

    revalidatePublicTeamSurfaces();
    return { success: "Kaydedildi ve sitede yayınlandı." };
  } catch (error) {
    if (error instanceof ContentModelError) return { error: error.message };
    return { error: "Yayınlama başarısız oldu." };
  }
}

export async function archiveTeamMemberAction(
  entityId: string,
  input: { archived: boolean; acknowledgedImpact: boolean },
): Promise<ActionState> {
  const context = await resolveAdminContext();
  try {
    await archiveEntityWithDependencyCheck(prisma, context, entityId, TEAM_MEMBER_CONTENT_TYPE, input);
    revalidatePublicTeamSurfaces();
    return { success: input.archived ? "Kurul üyesi arşivlendi." : "Kurul üyesi arşivden çıkarıldı." };
  } catch (error) {
    if (error instanceof ContentModelError) return { error: error.message };
    return { error: "İşlem tamamlanamadı." };
  }
}

export async function deleteTeamMemberAction(entityId: string): Promise<ActionState> {
  const context = await resolveAdminContext();
  try {
    await deleteEntityIfSafe(prisma, context, entityId, TEAM_MEMBER_CONTENT_TYPE);
    revalidatePublicTeamSurfaces();
    return { success: "Kurul üyesi silindi." };
  } catch (error) {
    if (error instanceof ContentModelError) return { error: error.message };
    return { error: "Silme işlemi tamamlanamadı." };
  }
}

export async function reorderTeamMembersAction(orderedIds: readonly string[]): Promise<void> {
  const context = await resolveAdminContext();
  await adminReorderEntities(prisma, context, { contentType: TEAM_MEMBER_CONTENT_TYPE, orderedIds });
  revalidatePath("/manage/team");
}

/** One-click "Kaydet ve yayınla": saves the draft, then publishes the very
 * revision that save produced. Any refusal from either half is returned as
 * is, so a failed publish never looks like a successful save. */
export async function saveAndPublishTeamMemberAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const saved = await saveTeamMemberDraftAction(_previous, formData);
  if (saved.error) return saved;

  const entityId = text(formData, "entityId");
  const localeValue = text(formData, "locale");
  if (!entityId || !isLocale(localeValue)) return { error: "Geçersiz istek." };

  const refreshed = await refreshEditorFormPointers(prisma, formData, entityId, localeValue as ContentLocale);
  return publishTeamMemberAction(_previous, refreshed);
}
