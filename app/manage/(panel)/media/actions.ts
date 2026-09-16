"use server";

import { revalidatePath } from "next/cache";
import { resolveAdminContext } from "@/lib/content-model/admin-context";
import { prisma } from "@/lib/db";
import {
  archiveMediaAsset,
  createMediaAsset,
  deleteMediaAsset,
  finalizeMediaUpload,
  getMediaAsset,
  getMediaUsageReport,
  listMediaAssets,
  replaceMediaAssetUsage,
  requestMediaUploadTicket,
  unarchiveMediaAsset,
  updateMediaAssetMetadata,
  verifyMediaAssetStorage,
  MediaDependencyError,
} from "@/lib/media/service";
import { validateUploadBuffer, MediaValidationError } from "@/lib/media/validation";
import type { MediaAssetDto, MediaUploadTicket, MediaUsageReport } from "@/lib/media/types";

export type ActionResult<T = unknown> =
  | { success: true; data: T; message?: string; error?: never }
  | { success: false; error: string; code?: string; report?: MediaUsageReport; data?: never };


export async function uploadMediaAction(
  formData: FormData
): Promise<ActionResult<MediaAssetDto>> {
  try {
    const context = await resolveAdminContext();
    const file = formData.get("file");
    const altText = (formData.get("altText") as string) || undefined;
    const caption = (formData.get("caption") as string) || undefined;

    if (!file || !(file instanceof Blob)) {
      return { success: false, error: "Lütfen geçerli bir dosya seçin." };
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const originalFilename = (file as File).name || "uploaded-file";
    const claimedMime = file.type || undefined;

    const validated = validateUploadBuffer(buffer, originalFilename, claimedMime);
    const asset = await createMediaAsset(prisma, validated, context, { altText, caption });

    revalidatePath("/manage/media");
    return {
      success: true,
      data: asset,
      message: `'${asset.filename}' başarıyla yüklendi.`,
    };
  } catch (error) {
    if (error instanceof MediaValidationError) {
      return { success: false, error: error.message, code: error.code };
    }
    const message = error instanceof Error ? error.message : "Yükleme sırasında hata oluştu.";
    return { success: false, error: message };
  }
}

/**
 * Issues a direct-upload ticket - the browser `PUT`s the file straight to
 * storage from here, never through this action's own request body. Pairs
 * with `finalizeMediaUploadAction`; see `useMediaUpload` for the client
 * pipeline both `MediaPickerModal` and the media library's upload flow share.
 */
export async function requestMediaUploadTicketAction(input: {
  filename: string;
  mimeType: string;
  byteSize: number;
}): Promise<ActionResult<MediaUploadTicket>> {
  try {
    const context = await resolveAdminContext();
    const ticket = await requestMediaUploadTicket(prisma, input, context);
    return { success: true, data: ticket };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Yükleme bileti oluşturulamadı.";
    return { success: false, error: message };
  }
}

export async function finalizeMediaUploadAction(input: {
  objectKey: string;
  originalFilename: string;
  altText?: string;
  caption?: string;
}): Promise<ActionResult<MediaAssetDto>> {
  try {
    const context = await resolveAdminContext();
    const asset = await finalizeMediaUpload(
      prisma,
      { objectKey: input.objectKey, originalFilename: input.originalFilename },
      context,
      { altText: input.altText, caption: input.caption }
    );
    revalidatePath("/manage/media");
    return {
      success: true,
      data: asset,
      message: asset.duplicate ? `'${asset.filename}' zaten kütüphanede mevcut.` : `'${asset.filename}' başarıyla yüklendi.`,
    };
  } catch (error) {
    if (error instanceof MediaValidationError) {
      return { success: false, error: error.message, code: error.code };
    }
    const message = error instanceof Error ? error.message : "Yükleme tamamlanamadı.";
    return { success: false, error: message };
  }
}

export async function updateMediaMetadataAction(
  id: string,
  metadata: { altText?: string | null; caption?: string | null }
): Promise<ActionResult<MediaAssetDto>> {
  try {
    const context = await resolveAdminContext();
    const updated = await updateMediaAssetMetadata(prisma, id, metadata, context);
    revalidatePath("/manage/media");
    return {
      success: true,
      data: updated,
      message: "Medya bilgileri güncellendi.",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Güncelleme hatası.";
    return { success: false, error: message };
  }
}

export async function archiveMediaAction(
  id: string
): Promise<ActionResult<MediaAssetDto>> {
  try {
    const context = await resolveAdminContext();
    const archived = await archiveMediaAsset(prisma, id, context);
    revalidatePath("/manage/media");
    return {
      success: true,
      data: archived,
      message: `'${archived.filename}' arşive kaldırıldı.`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Arşivleme hatası.";
    return { success: false, error: message };
  }
}

export async function unarchiveMediaAction(
  id: string
): Promise<ActionResult<MediaAssetDto>> {
  try {
    const context = await resolveAdminContext();
    const unarchived = await unarchiveMediaAsset(prisma, id, context);
    revalidatePath("/manage/media");
    return {
      success: true,
      data: unarchived,
      message: `'${unarchived.filename}' arşivden çıkarıldı.`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Arşivden çıkarma hatası.";
    return { success: false, error: message };
  }
}

/**
 * Deletes a `MediaAsset`. Deliberately takes no `force` parameter - unlike
 * `lib/media/service.ts`'s `deleteMediaAsset`, this admin-reachable action
 * never forwards a client-supplied override for the in-use check. Media
 * currently referenced by content is not deletable from this surface at
 * all; `replaceMediaUsageAction` (move usages, then optionally archive the
 * original) is the only sanctioned path to freeing an in-use asset up for
 * deletion. This is the canonical "used media is never safely deletable"
 * rule enforced at the action boundary, not just left to UI convention.
 */
export async function deleteMediaAction(
  id: string
): Promise<ActionResult<{ deleted: boolean }>> {
  try {
    const context = await resolveAdminContext();
    await deleteMediaAsset(prisma, id, context);
    revalidatePath("/manage/media");
    return {
      success: true,
      data: { deleted: true },
      message: "Medya dosyası başarıyla silindi.",
    };
  } catch (error) {
    if (error instanceof MediaDependencyError) {
      return {
        success: false,
        error: error.message,
        code: error.code,
        report: error.report,
      };
    }
    const message = error instanceof Error ? error.message : "Silme işlemi başarısız.";
    return { success: false, error: message };
  }
}

export async function replaceMediaUsageAction(input: {
  oldAssetId: string;
  newAssetId: string;
  archiveOld?: boolean;
}): Promise<ActionResult<MediaUsageReport>> {
  try {
    const context = await resolveAdminContext();
    const report = await replaceMediaAssetUsage(prisma, input, context);
    revalidatePath("/manage/media");
    return {
      success: true,
      data: report,
      message: "Medya kullanımları yeni dosyaya taşındı.",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Değiştirme hatası.";
    return { success: false, error: message };
  }
}

export async function getMediaUsageReportAction(
  assetId: string
): Promise<ActionResult<MediaUsageReport>> {
  try {
    await resolveAdminContext();
    const report = await getMediaUsageReport(prisma, assetId);
    return { success: true, data: report };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Rapor oluşturulamadı.";
    return { success: false, error: message };
  }
}

/**
 * Re-checks whether an asset's object still exists in storage (Story 4.3's
 * `verifyMediaAssetStorage`) and persists the result on `storageStatus` -
 * the admin-triggered half of missing/broken media recovery. A `MISSING`
 * result is not itself destructive; the admin UI follows up with the same
 * replace-and-archive flow used for a dependency-blocked delete.
 */
export async function verifyMediaStorageAction(
  id: string
): Promise<ActionResult<MediaAssetDto>> {
  try {
    await resolveAdminContext();
    const verified = await verifyMediaAssetStorage(prisma, id);
    revalidatePath("/manage/media");
    return {
      success: true,
      data: verified,
      message:
        verified.storageStatus === "MISSING"
          ? `'${verified.filename}' depoda bulunamadı.`
          : `'${verified.filename}' depoda doğrulandı.`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Depo doğrulaması başarısız.";
    return { success: false, error: message };
  }
}
