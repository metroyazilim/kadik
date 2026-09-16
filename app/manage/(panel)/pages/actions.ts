"use server";

import { refreshEditorFormPointers } from "@/lib/content-model/editor-form-pointers";
import { revalidatePath } from "next/cache";
import type { ContentLocale, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { resolveAdminContext } from "@/lib/content-model/admin-context";
import { ensureLocaleTranslation, getEntityEditView, type EntityEditView } from "@/lib/content-model/collection-admin";
import { adminSaveDraft, adminPublish } from "@/lib/content-model/admin-content-store";
import { assertMediaAssetsExist, resolveMediaAssetPreviews, type MediaAssetPreview } from "@/lib/content-model/content-media";
import {
  ABOUT_PAGE_CONTENT_TYPE,
  ABOUT_PAGE_SCHEMA_VERSION,
  type AboutPagePayload,
} from "@/lib/content-model/about-page-schema";
import { ensureContentPageEntity } from "@/lib/content-model/content-page-registry";
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

/** Rich text ('text' field) is stored/sanitized as-is - never `.trim()`-collapsed the way plain labels are, so intentional leading/trailing markup spacing survives a round trip. */
function rawText(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function parseJsonArray(formData: FormData, name: string): unknown {
  const raw = formData.get(name);
  if (typeof raw !== "string" || raw.length === 0) {
    throw new ContentModelError("invalidInput", `Field '${name}' is required.`);
  }
  try {
    return JSON.parse(raw);
  } catch {
    throw new ContentModelError("invalidInput", `Field '${name}' is not valid JSON.`);
  }
}

function revalidatePublicAboutSurfaces(): void {
  revalidatePath("/manage/pages");
  revalidatePath("/hakkimizda");
  revalidatePath("/en/about");
}

export type AboutEditViewData = Readonly<{
  entityId: string;
  view: EntityEditView;
  assetPreviews: Readonly<Record<string, MediaAssetPreview>>;
}>;

/** Bootstraps the "about" registry row on first access (mirrors `ensureSiteSettingsEntity`'s own idempotent-on-every-read contract), then hydrates every locale's draft/published payload plus every referenced `MediaAsset` preview in one call. */
export async function getAboutEditViewAction(): Promise<AboutEditViewData> {
  await resolveAdminContext();
  const { entityId } = await ensureContentPageEntity(prisma, "about");
  const view = await getEntityEditView(prisma, entityId, ABOUT_PAGE_CONTENT_TYPE);
  if (!view) {
    throw new ContentModelError("internal", "The About entity could not be loaded after it was ensured to exist.");
  }

  const assetIds: (string | null | undefined)[] = [];
  for (const translation of Object.values(view.translations)) {
    const payload = (translation?.draftPayload ?? translation?.publishedPayload ?? null) as AboutPagePayload | null;
    if (!payload) continue;
    assetIds.push(payload.collageImageAssetId, payload.authorImageAssetId);
  }
  const assetPreviews = await resolveMediaAssetPreviews(prisma, assetIds);
  return { entityId, view, assetPreviews };
}

export async function saveAboutDraftAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const context = await resolveAdminContext();
  const entityId = text(formData, "entityId");
  const localeValue = text(formData, "locale");
  if (!entityId || !isLocale(localeValue)) return { error: "Geçersiz istek." };
  const locale = localeValue as ContentLocale;

  try {
    const payload: AboutPagePayload = {
      banner: text(formData, "banner"),
      subtitle: text(formData, "subtitle"),
      titleBefore: text(formData, "titleBefore"),
      titleAccent: text(formData, "titleAccent"),
      titleAfter: text(formData, "titleAfter"),
      text: rawText(formData, "text"),
      collageImageAssetId: optionalText(formData, "collageImageAssetId"),
      collageAlt: text(formData, "collageAlt"),
      experienceValue: text(formData, "experienceValue"),
      experienceUnit: text(formData, "experienceUnit"),
      experienceLabel: text(formData, "experienceLabel"),
      features: parseJsonArray(formData, "features") as AboutPagePayload["features"],
      offeringSubtitle: text(formData, "offeringSubtitle"),
      offeringTitle: text(formData, "offeringTitle"),
      offeringLabels: parseJsonArray(formData, "offeringLabels") as AboutPagePayload["offeringLabels"],
      marquee: parseJsonArray(formData, "marquee") as AboutPagePayload["marquee"],
      teamSubtitle: text(formData, "teamSubtitle"),
      teamTitle: text(formData, "teamTitle"),
      authorName: text(formData, "authorName"),
      authorRole: text(formData, "authorRole"),
      authorImageAssetId: optionalText(formData, "authorImageAssetId"),
      seoTitle: optionalText(formData, "seoTitle"),
      seoDescription: optionalText(formData, "seoDescription"),
    };

    const referencedAssetIds = [payload.collageImageAssetId, payload.authorImageAssetId];
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
      schemaVersion: ABOUT_PAGE_SCHEMA_VERSION,
      payload: payload as unknown as Prisma.InputJsonValue,
    });

    if (!result.ok) {
      return {
        error: `Bu dilde arada başka bir değişiklik kaydedilmiş (v${result.current.version}). Sayfayı yenileyip tekrar deneyin.`,
      };
    }

    revalidatePublicAboutSurfaces();
    return { success: `${locale.toUpperCase()} kaydedildi.` };
  } catch (error) {
    if (error instanceof ContentModelError) return { error: error.message };
    return { error: "Sayfa kaydedilemedi. Alanları kontrol edip tekrar deneyin." };
  }
}

export async function publishAboutAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
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
    const result = await adminPublish(
      prisma,
      context,
      { translationId, expectedVersion, expectedDraftRevisionId },
      undefined,
      {
        recorder: persistedOutboxRecorder,
        tags: [contentEntityTag(entityId), contentAvailabilityTag(entityId, locale), seoIndexTag()],
      },
    );

    if (!result.ok) {
      return { error: "Yayınlama sırasında çakışma oluştu. Sayfayı yenileyip tekrar deneyin." };
    }

    revalidatePublicAboutSurfaces();
    return { success: `${locale.toUpperCase()} yayınlandı.` };
  } catch (error) {
    if (error instanceof ContentModelError) return { error: error.message };
    return { error: "Yayınlama başarısız oldu." };
  }
}

/** One-click "Kaydet ve yayınla": saves, then publishes that very revision. */
export async function saveAndPublishAboutAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const saved = await saveAboutDraftAction(_previous, formData);
  if (saved.error) return saved;

  const entityId = text(formData, "entityId");
  const localeValue = text(formData, "locale");
  if (!entityId || !isLocale(localeValue)) return { error: "Geçersiz istek." };

  const refreshed = await refreshEditorFormPointers(prisma, formData, entityId, localeValue as ContentLocale);
  return publishAboutAction(_previous, refreshed);
}
