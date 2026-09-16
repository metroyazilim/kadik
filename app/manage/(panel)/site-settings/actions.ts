"use server";

import { refreshEditorFormPointers } from "@/lib/content-model/editor-form-pointers";
import { revalidatePath } from "next/cache";
import type { ContentLocale, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { resolveAdminContext } from "@/lib/content-model/admin-context";
import { ensureLocaleTranslation, getEntityEditView, listCollectionPage, type EntityEditView } from "@/lib/content-model/collection-admin";
import { adminSaveDraft, adminPublish } from "@/lib/content-model/admin-content-store";
import { assertMediaAssetsExist, resolveMediaAssetPreviews, type MediaAssetPreview } from "@/lib/content-model/content-media";
import {
  SITE_SETTINGS_CONTENT_TYPE,
  SITE_SETTINGS_SCHEMA_VERSION,
  type FooterColumnPayload,
  type NavItemPayload,
  type SiteSettingsPayload,
} from "@/lib/content-model/site-settings-schema";
import { ensureSiteSettingsEntity } from "@/lib/content-model/site-settings-registry";
import { resolveNavigationStatus, type ResolvedNavItem } from "@/lib/content-model/site-settings-nav";
import { persistedOutboxRecorder } from "@/lib/content-model/outbox-store";
import { contentAvailabilityTag, contentEntityTag, navigationConfigTag, seoIndexTag } from "@/lib/content-model/cache-tags";
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

function parseJson(formData: FormData, name: string): unknown {
  const raw = formData.get(name);
  if (typeof raw !== "string" || raw.length === 0) return [];
  try {
    return JSON.parse(raw);
  } catch {
    throw new ContentModelError("invalidInput", `Field '${name}' is not valid JSON.`);
  }
}

function revalidatePublicSiteSettingsSurfaces(): void {
  revalidatePath("/manage/site-settings");
  revalidatePath("/terms");
  revalidatePath("/privacy");
  revalidatePath("/en/terms");
  revalidatePath("/en/privacy");
}

export type SiteSettingsEditViewData = Readonly<{
  entityId: string;
  view: EntityEditView;
  assetPreviews: Readonly<Record<string, MediaAssetPreview>>;
}>;

/** Bootstraps the singleton entity on first access, then hydrates every locale's draft/published payload for the full-page editor in one call. */
export async function getSiteSettingsEditViewAction(): Promise<SiteSettingsEditViewData> {
  await resolveAdminContext();
  const { entityId } = await ensureSiteSettingsEntity(prisma);
  const view = await getEntityEditView(prisma, entityId, SITE_SETTINGS_CONTENT_TYPE);
  if (!view) throw new ContentModelError("internal", "Site settings entity could not be loaded.");

  const assetIds: (string | null | undefined)[] = [];
  for (const translation of Object.values(view.translations)) {
    const payload = (translation?.draftPayload ?? translation?.publishedPayload ?? null) as SiteSettingsPayload | null;
    if (payload?.brand.logoAssetId) assetIds.push(payload.brand.logoAssetId);
  }
  const assetPreviews = await resolveMediaAssetPreviews(prisma, assetIds);
  return { entityId, view, assetPreviews };
}

/** Resolves every navigation/footer target's live status for `locale` (AC-6.1 bullet 4) - shown next to each item in the editor so a draft/archived/missing reference explains itself instead of silently disappearing. */
export async function resolveNavigationStatusAction(
  localeValue: string,
  navigation: readonly NavItemPayload[],
): Promise<readonly ResolvedNavItem[]> {
  await resolveAdminContext();
  if (!isLocale(localeValue)) return [];
  return resolveNavigationStatus(prisma, localeValue as ContentLocale, navigation);
}

export type NavTargetCandidate = Readonly<{ entityId: string; label: string; archived: boolean }>;

function candidateLabel(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) return null;
  const record = payload as Record<string, unknown>;
  const title = record.title ?? record.question ?? record.name;
  return typeof title === "string" && title.trim().length > 0 ? title.trim() : null;
}

/** Lightweight entity picker source for the "collection" nav-target kind -
 * reuses the same paginated list read every content type's own list page
 * uses, never a bespoke query. A nav target is picked from a short list, so
 * the first 100 entities of the content type are more than enough. */
export async function listNavTargetCandidatesAction(contentType: string): Promise<readonly NavTargetCandidate[]> {
  await resolveAdminContext();
  const { rows } = await listCollectionPage(prisma, contentType, { page: 1, perPage: 100 });
  return rows.map((row) => ({
    entityId: row.entityId,
    label: candidateLabel(row.displayPayload) ?? `(başlıksız - ${row.entityId.slice(0, 8)})`,
    archived: row.archived,
  }));
}


export async function saveSiteSettingsDraftAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const context = await resolveAdminContext();
  const { entityId } = await ensureSiteSettingsEntity(prisma);
  const localeValue = text(formData, "locale");
  if (!isLocale(localeValue)) return { error: "Geçersiz istek." };
  const locale = localeValue as ContentLocale;

  try {
    const payload: SiteSettingsPayload = {
      brand: {
        name: text(formData, "brand.name"),
        logoAssetId: optionalText(formData, "brand.logoAssetId"),
      },
      contact: {
        email: optionalText(formData, "contact.email"),
        phone: optionalText(formData, "contact.phone"),
        address: optionalText(formData, "contact.address"),
      },
      cta: {
        label: optionalText(formData, "cta.label"),
        url: optionalText(formData, "cta.url"),
      },
      navigation: parseJson(formData, "navigation") as readonly NavItemPayload[],
      footer: {
        summary: text(formData, "footer.summary"),
        columns: parseJson(formData, "footerColumns") as readonly FooterColumnPayload[],
      },
      mission: text(formData, "mission"),
      vision: text(formData, "vision"),
      termsBody: text(formData, "termsBody"),
      privacyBody: text(formData, "privacyBody"),
    };

    const referencedAssetIds = [payload.brand.logoAssetId];
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
      schemaVersion: SITE_SETTINGS_SCHEMA_VERSION,
      payload: payload as unknown as Prisma.InputJsonValue,
    });

    if (!result.ok) {
      return {
        error: `Bu dilde arada başka bir değişiklik kaydedilmiş (v${result.current.version}). Sayfayı yenileyip tekrar deneyin.`,
      };
    }

    revalidatePath("/manage/site-settings");
    return { success: `${locale.toUpperCase()} kaydedildi.` };
  } catch (error) {
    if (error instanceof ContentModelError) return { error: error.message };
    return { error: "Site ayarları kaydedilemedi. Alanları kontrol edip tekrar deneyin." };
  }
}

export async function publishSiteSettingsAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const context = await resolveAdminContext();
  const { entityId } = await ensureSiteSettingsEntity(prisma);
  const localeValue = text(formData, "locale");
  if (!isLocale(localeValue)) return { error: "Geçersiz istek." };
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
        tags: [contentEntityTag(entityId), contentAvailabilityTag(entityId, locale), navigationConfigTag(), seoIndexTag()],
      },
    );

    if (!result.ok) {
      return { error: "Yayınlama sırasında çakışma oluştu. Sayfayı yenileyip tekrar deneyin." };
    }

    revalidatePath("/manage/site-settings");
    revalidatePublicSiteSettingsSurfaces();
    return { success: `${locale.toUpperCase()} yayınlandı.` };
  } catch (error) {
    if (error instanceof ContentModelError) return { error: error.message };
    return { error: "Yayınlama başarısız oldu." };
  }
}

/** One-click "Kaydet ve yayınla": saves, then publishes that very revision. */
export async function saveAndPublishSiteSettingsAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const saved = await saveSiteSettingsDraftAction(_previous, formData);
  if (saved.error) return saved;

  const { entityId } = await ensureSiteSettingsEntity(prisma);
  const localeValue = text(formData, "locale");
  if (!entityId || !isLocale(localeValue)) return { error: "Geçersiz istek." };

  const refreshed = await refreshEditorFormPointers(prisma, formData, entityId, localeValue as ContentLocale);
  return publishSiteSettingsAction(_previous, refreshed);
}
