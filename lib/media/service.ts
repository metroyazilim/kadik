import type { ContentLocale, Prisma, PrismaClient } from "@prisma/client";
import { assertAdminContext, type AdminContext } from "../content-model/admin-context";
import { getStorageProvider } from "./storage";
import {
  EXTENSION_MIME_MAP,
  MAX_DOCUMENT_SIZE_BYTES,
  MAX_IMAGE_SIZE_BYTES,
  MAX_SVG_SIZE_BYTES,
  sanitizeFilename,
  validateUploadBuffer,
} from "./validation";
import type {
  MediaAssetDto,
  MediaKind,
  MediaMimeType,
  MediaExtension,
  MediaUploadTicket,
  MediaUsageDto,
  MediaUsageReport,
  ValidatedMediaInput,
} from "./types";

export class MediaError extends Error {
  readonly code:
    | "notFound"
    | "dependencyConflict"
    | "storageFailure"
    | "invalidInput"
    | "alreadyArchived";

  constructor(
    code:
      | "notFound"
      | "dependencyConflict"
      | "storageFailure"
      | "invalidInput"
      | "alreadyArchived",
    message: string
  ) {
    super(message);
    this.name = "MediaError";
    this.code = code;
  }
}

export class MediaDependencyError extends MediaError {
  readonly report: MediaUsageReport;

  constructor(message: string, report: MediaUsageReport) {
    super("dependencyConflict", message);
    this.name = "MediaDependencyError";
    this.report = report;
  }
}

/** Row shape shared by every Prisma read this module maps to `MediaAssetDto`. */
type MediaAssetRow = {
  id: string;
  filename: string;
  objectKey: string;
  url: string;
  mimeType: string;
  extension: string;
  byteSize: number;
  width: number | null;
  height: number | null;
  checksum: string;
  altText: string | null;
  caption: string | null;
  archivedAt: Date | null;
  storageStatus: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  _count?: { usages: number };
};

/**
 * Single mapping seam from a Prisma `MediaAsset` row to the public DTO.
 * Every read path in this module goes through here so `archived` (derived)
 * and `storageStatus`/`extension` typing never drift between call sites.
 */
function toMediaAssetDto(row: MediaAssetRow, extra?: { duplicate?: boolean }): MediaAssetDto {
  return {
    id: row.id,
    filename: row.filename,
    objectKey: row.objectKey,
    url: row.url,
    mimeType: row.mimeType as MediaMimeType,
    extension: row.extension as MediaExtension,
    byteSize: row.byteSize,
    width: row.width,
    height: row.height,
    checksum: row.checksum,
    altText: row.altText,
    caption: row.caption,
    archived: row.archivedAt !== null,
    archivedAt: row.archivedAt,
    storageStatus: row.storageStatus as MediaAssetDto["storageStatus"],
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    usageCount: row._count?.usages,
    duplicate: extra?.duplicate,
  };
}

function generateObjectKey(sanitizedFilename: string): string {
  const date = new Date();
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const randomSuffix = Math.random().toString(36).slice(2, 10);
  return `uploads/${year}/${month}/${Date.now()}-${randomSuffix}-${sanitizedFilename}`;
}

/**
 * Creates the `MediaAsset` row for a validated file whose bytes are
 * *already* sitting in storage at `uploadResult.objectKey`, resolving the
 * `MediaUploadAttempt` ledger row in the same transaction. Shared tail end
 * of both upload paths - `createMediaAsset` (buffered: uploads first, then
 * calls this) and `finalizeMediaUpload` (direct: the browser already `PUT`
 * the object, this runs after downloading and validating it) - so a
 * `MediaAsset` row has exactly one construction path regardless of which
 * route the bytes travelled.
 */
async function persistMediaAsset(
  prisma: PrismaClient,
  input: ValidatedMediaInput,
  uploadResult: { objectKey: string; url: string },
  attemptId: string,
  context: AdminContext,
  options?: { altText?: string; caption?: string }
): Promise<MediaAssetDto> {
  const asset = await prisma.$transaction(async (tx) => {
    const created = await tx.mediaAsset.create({
      data: {
        filename: input.sanitizedFilename,
        objectKey: uploadResult.objectKey,
        url: uploadResult.url,
        mimeType: input.mimeType,
        extension: input.extension,
        byteSize: input.byteSize,
        width: input.width,
        height: input.height,
        checksum: input.checksum,
        altText: options?.altText?.trim() || null,
        caption: options?.caption?.trim() || null,
        createdBy: context.actorId,
      },
    });

    await tx.mediaUploadAttempt.update({
      where: { id: attemptId },
      data: { resolvedAt: new Date() },
    });

    await tx.auditLog.create({
      data: {
        action: "media.upload",
        entity: "MediaAsset",
        entityId: created.id,
        userId: context.actorId,
        metadata: {
          filename: created.filename,
          objectKey: created.objectKey,
          mimeType: created.mimeType,
          byteSize: created.byteSize,
          checksum: created.checksum,
        },
      },
    });

    return created;
  });

  return toMediaAssetDto({ ...asset, _count: { usages: 0 } });
}

/**
 * Uploads a validated file and creates its canonical `MediaAsset` row.
 * Shared by both upload paths (media library and direct-from-content-form
 * uploads via `MediaPickerModal`) - callers never touch storage directly.
 *
 * Idempotency (AC-4.1): a checksum match against an existing, non-archived,
 * `ACTIVE` asset short-circuits before any storage write and returns that
 * asset with `duplicate: true` - a retried or duplicate upload never
 * produces a second object in storage or a second database row.
 *
 * Orphan safety: the object key is recorded in `MediaUploadAttempt`
 * *before* the storage write, and resolved (in the same transaction that
 * creates the `MediaAsset` row) only after the write succeeds. A crash
 * between those two steps leaves a resolvable orphan row that
 * `cleanupOrphanMediaUploads` can find and reap, instead of a silently
 * leaked object with no trace anywhere.
 */
export async function createMediaAsset(
  prisma: PrismaClient,
  input: ValidatedMediaInput,
  context: AdminContext,
  options?: { altText?: string; caption?: string }
): Promise<MediaAssetDto> {
  assertAdminContext(context);

  const existing = await prisma.mediaAsset.findFirst({
    where: { checksum: input.checksum, archivedAt: null, storageStatus: "ACTIVE" },
    include: { _count: { select: { usages: true } } },
  });
  if (existing) {
    return toMediaAssetDto(existing, { duplicate: true });
  }

  const storage = getStorageProvider();
  const objectKey = generateObjectKey(input.sanitizedFilename);

  const attempt = await prisma.mediaUploadAttempt.create({
    data: { objectKey, createdBy: context.actorId },
  });

  let uploadResult;
  try {
    uploadResult = await storage.upload({
      objectKey,
      buffer: input.buffer,
      mimeType: input.mimeType,
    });
  } catch (error) {
    // Nothing was written to storage, so this attempt row describes no
    // real orphan - remove it rather than leaving it for the cleanup pass.
    await prisma.mediaUploadAttempt.delete({ where: { id: attempt.id } }).catch(() => {});
    const message = error instanceof Error ? error.message : "Storage upload failed.";
    throw new MediaError("storageFailure", message);
  }

  return persistMediaAsset(prisma, input, uploadResult, attempt.id, context, options);
}

/**
 * Cheap, byte-free pre-check for `requestMediaUploadTicket`: the same
 * extension/MIME pairing and size-ceiling rules `validateUploadBuffer`
 * enforces, minus magic bytes (there is no file content to inspect yet -
 * the browser hasn't uploaded anything). Rejects an obviously wrong request
 * before a `MediaUploadAttempt` row or a presigned URL is ever issued;
 * `finalizeMediaUpload`'s full `validateUploadBuffer` pass on the
 * downloaded bytes remains the actual trust boundary.
 */
function assertPlausibleUploadClaim(filename: string, mimeType: string, byteSize: number): void {
  const sanitized = sanitizeFilename(filename);
  const extMatch = sanitized.match(/\.[a-zA-Z0-9]+$/);
  const ext = (extMatch ? extMatch[0].toLowerCase() : "") as MediaExtension;

  if (!ext || !(ext in EXTENSION_MIME_MAP)) {
    throw new MediaError("invalidInput", `Unsupported file extension: ${ext || "none"}.`);
  }
  const expectedMime = EXTENSION_MIME_MAP[ext];
  if (mimeType && mimeType !== expectedMime && !(mimeType === "image/jpg" && expectedMime === "image/jpeg")) {
    throw new MediaError("invalidInput", `Claimed type '${mimeType}' does not match extension '${ext}'.`);
  }
  const ceiling =
    expectedMime === "image/svg+xml"
      ? MAX_SVG_SIZE_BYTES
      : expectedMime === "application/pdf"
        ? MAX_DOCUMENT_SIZE_BYTES
        : MAX_IMAGE_SIZE_BYTES;
  if (byteSize <= 0 || byteSize > ceiling) {
    throw new MediaError("invalidInput", `File size ${byteSize} bytes is outside the allowed range for '${expectedMime}'.`);
  }
}

/**
 * Issues a presigned direct-upload ticket (Story 4.1's documented
 * presigned-upload capability, now wired to a real flow): the browser
 * `PUT`s bytes straight to storage, never through this server's buffered
 * request body. Records the `MediaUploadAttempt` ledger row up front, same
 * orphan-safety contract as the buffered path - a client that requests a
 * ticket and never finishes the upload leaves a reapable orphan, not a
 * silent gap.
 */
export async function requestMediaUploadTicket(
  prisma: PrismaClient,
  input: { filename: string; mimeType: string; byteSize: number },
  context: AdminContext
): Promise<MediaUploadTicket> {
  assertAdminContext(context);
  assertPlausibleUploadClaim(input.filename, input.mimeType, input.byteSize);

  const sanitized = sanitizeFilename(input.filename);
  const objectKey = generateObjectKey(sanitized);
  await prisma.mediaUploadAttempt.create({
    data: { objectKey, createdBy: context.actorId },
  });

  const storage = getStorageProvider();
  const presigned = await storage.getPresignedUploadUrl(objectKey, input.mimeType);

  return {
    objectKey: presigned.objectKey,
    uploadUrl: presigned.uploadUrl,
    method: presigned.method,
    headers: presigned.headers,
    expiresInSeconds: presigned.expiresInSeconds,
  };
}

/**
 * Completes a direct upload: downloads the object a browser already `PUT`
 * to storage under `objectKey`, runs the exact same `validateUploadBuffer`
 * pass the buffered path runs, and only then creates the `MediaAsset` row.
 * A client-side presigned `PUT` bypasses no security check - this is where
 * the server finally inspects the real bytes (AC-4.1-02/03 hold for both
 * upload paths, not just the buffered one).
 *
 * A failing validation deletes the just-uploaded object and its
 * `MediaUploadAttempt` row before throwing - an invalid direct upload never
 * lingers in storage waiting for the orphan sweep. A checksum match against
 * an existing active asset does the same cleanup and returns that asset
 * with `duplicate: true`, mirroring `createMediaAsset`'s CAP-3 contract.
 */
export async function finalizeMediaUpload(
  prisma: PrismaClient,
  input: { objectKey: string; originalFilename: string },
  context: AdminContext,
  options?: { altText?: string; caption?: string }
): Promise<MediaAssetDto> {
  assertAdminContext(context);

  const attempt = await prisma.mediaUploadAttempt.findUnique({ where: { objectKey: input.objectKey } });
  if (!attempt || attempt.resolvedAt !== null) {
    throw new MediaError("invalidInput", "Upload ticket not found or already used.");
  }

  const storage = getStorageProvider();
  let buffer: Buffer;
  try {
    buffer = await storage.download(input.objectKey);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Uploaded object could not be read back from storage.";
    throw new MediaError("storageFailure", message);
  }

  let validated: ValidatedMediaInput;
  try {
    validated = validateUploadBuffer(buffer, input.originalFilename);
  } catch (error) {
    await storage.delete(input.objectKey).catch(() => {});
    await prisma.mediaUploadAttempt.delete({ where: { id: attempt.id } }).catch(() => {});
    throw error;
  }

  const existing = await prisma.mediaAsset.findFirst({
    where: { checksum: validated.checksum, archivedAt: null, storageStatus: "ACTIVE" },
    include: { _count: { select: { usages: true } } },
  });
  if (existing) {
    await storage.delete(input.objectKey).catch(() => {});
    await prisma.mediaUploadAttempt.delete({ where: { id: attempt.id } }).catch(() => {});
    return toMediaAssetDto(existing, { duplicate: true });
  }

  return persistMediaAsset(
    prisma,
    validated,
    { objectKey: input.objectKey, url: storage.getPublicUrl(input.objectKey) },
    attempt.id,
    context,
    options
  );
}

/**
 * Reaps `MediaUploadAttempt` rows left unresolved past `olderThanMs` -
 * the crash window between a successful storage write and the database
 * transaction that would have resolved the attempt. Deletes the storage
 * object (idempotent: a 404 from a partially-completed upload is treated
 * as already-clean) and the ledger row together.
 */
export async function cleanupOrphanMediaUploads(
  prisma: PrismaClient,
  olderThanMs = 60 * 60 * 1000
): Promise<{ cleaned: number; objectKeys: string[] }> {
  const cutoff = new Date(Date.now() - olderThanMs);
  const stale = await prisma.mediaUploadAttempt.findMany({
    where: { resolvedAt: null, createdAt: { lt: cutoff } },
  });

  if (stale.length === 0) {
    return { cleaned: 0, objectKeys: [] };
  }

  const storage = getStorageProvider();
  const objectKeys: string[] = [];

  for (const row of stale) {
    await storage.delete(row.objectKey).catch(() => {
      // Best-effort: the object may never have finished writing.
    });
    await prisma.mediaUploadAttempt.delete({ where: { id: row.id } }).catch(() => {});
    objectKeys.push(row.objectKey);
  }

  return { cleaned: objectKeys.length, objectKeys };
}

/**
 * Confirms an asset's object still exists in storage and records the
 * result on `storageStatus`. Drives Story 4.3's broken-media fallback:
 * once an asset is marked `MISSING`, `resolveMediaOrFallback` treats it
 * exactly like an archived asset even though its row and any `MediaUsage`
 * rows are untouched.
 */
export async function verifyMediaAssetStorage(
  prisma: PrismaClient,
  id: string
): Promise<MediaAssetDto> {
  const asset = await prisma.mediaAsset.findUnique({
    where: { id },
    include: { _count: { select: { usages: true } } },
  });
  if (!asset) {
    throw new MediaError("notFound", `MediaAsset with ID '${id}' not found.`);
  }

  const storage = getStorageProvider();
  const exists = await storage.exists(asset.objectKey);
  const nextStatus = exists ? "ACTIVE" : "MISSING";

  if (nextStatus === asset.storageStatus) {
    return toMediaAssetDto(asset);
  }

  const updated = await prisma.mediaAsset.update({
    where: { id },
    data: { storageStatus: nextStatus },
    include: { _count: { select: { usages: true } } },
  });

  return toMediaAssetDto(updated);
}

export async function getMediaAsset(
  prisma: PrismaClient,
  id: string
): Promise<MediaAssetDto> {
  const asset = await prisma.mediaAsset.findUnique({
    where: { id },
    include: {
      _count: {
        select: { usages: true },
      },
    },
  });

  if (!asset) {
    throw new MediaError("notFound", `MediaAsset with ID '${id}' not found.`);
  }

  return toMediaAssetDto(asset);
}

export async function listMediaAssets(
  prisma: PrismaClient,
  filter?: {
    kind?: MediaKind;
    query?: string;
    archived?: boolean;
    page?: number;
    pageSize?: number;
  }
): Promise<{
  assets: MediaAssetDto[];
  total: number;
  page: number;
  pageSize: number;
}> {
  const page = Math.max(1, filter?.page || 1);
  const pageSize = Math.max(1, Math.min(100, filter?.pageSize || 30));
  const skip = (page - 1) * pageSize;

  const where: Prisma.MediaAssetWhereInput = {};

  if (filter?.archived !== undefined) {
    where.archivedAt = filter.archived ? { not: null } : null;
  }
  if (filter?.kind === "image") {
    where.mimeType = { startsWith: "image/" };
  } else if (filter?.kind === "document") {
    where.mimeType = "application/pdf";
  }

  if (filter?.query?.trim()) {
    const q = filter.query.trim();
    where.OR = [
      { filename: { contains: q, mode: "insensitive" } },
      { altText: { contains: q, mode: "insensitive" } },
      { caption: { contains: q, mode: "insensitive" } },
    ];
  }

  const [rows, total] = await Promise.all([
    prisma.mediaAsset.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
      include: {
        _count: {
          select: { usages: true },
        },
      },
    }),
    prisma.mediaAsset.count({ where }),
  ]);

  return { assets: rows.map((row) => toMediaAssetDto(row)), total, page, pageSize };
}

export async function updateMediaAssetMetadata(
  prisma: PrismaClient,
  id: string,
  metadata: { altText?: string | null; caption?: string | null },
  context: AdminContext
): Promise<MediaAssetDto> {
  assertAdminContext(context);

  const existing = await prisma.mediaAsset.findUnique({ where: { id } });
  if (!existing) {
    throw new MediaError("notFound", `MediaAsset with ID '${id}' not found.`);
  }

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.mediaAsset.update({
      where: { id },
      data: {
        altText: metadata.altText !== undefined ? metadata.altText?.trim() || null : existing.altText,
        caption: metadata.caption !== undefined ? metadata.caption?.trim() || null : existing.caption,
      },
      include: {
        _count: {
          select: { usages: true },
        },
      },
    });

    await tx.auditLog.create({
      data: {
        action: "media.updateMetadata",
        entity: "MediaAsset",
        entityId: row.id,
        userId: context.actorId,
        metadata: {
          altText: row.altText,
          caption: row.caption,
        },
      },
    });

    return row;
  });

  return toMediaAssetDto(updated);
}

export async function archiveMediaAsset(
  prisma: PrismaClient,
  id: string,
  context: AdminContext
): Promise<MediaAssetDto> {
  assertAdminContext(context);

  const asset = await prisma.mediaAsset.findUnique({ where: { id } });
  if (!asset) {
    throw new MediaError("notFound", `MediaAsset with ID '${id}' not found.`);
  }
  if (asset.archivedAt !== null) {
    throw new MediaError("alreadyArchived", `MediaAsset '${asset.filename}' is already archived.`);
  }

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.mediaAsset.update({
      where: { id },
      data: { archivedAt: new Date() },
      include: {
        _count: {
          select: { usages: true },
        },
      },
    });

    await tx.auditLog.create({
      data: {
        action: "media.archive",
        entity: "MediaAsset",
        entityId: row.id,
        userId: context.actorId,
        metadata: {
          filename: row.filename,
          objectKey: row.objectKey,
        },
      },
    });

    return row;
  });

  return toMediaAssetDto(updated);
}

export async function unarchiveMediaAsset(
  prisma: PrismaClient,
  id: string,
  context: AdminContext
): Promise<MediaAssetDto> {
  assertAdminContext(context);

  const asset = await prisma.mediaAsset.findUnique({ where: { id } });
  if (!asset) {
    throw new MediaError("notFound", `MediaAsset with ID '${id}' not found.`);
  }

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.mediaAsset.update({
      where: { id },
      data: { archivedAt: null },
      include: {
        _count: {
          select: { usages: true },
        },
      },
    });

    await tx.auditLog.create({
      data: {
        action: "media.unarchive",
        entity: "MediaAsset",
        entityId: row.id,
        userId: context.actorId,
        metadata: {
          filename: row.filename,
          objectKey: row.objectKey,
        },
      },
    });

    return row;
  });

  return toMediaAssetDto(updated);
}

export async function getMediaUsageReport(
  prisma: PrismaClient,
  assetId: string
): Promise<MediaUsageReport> {
  const usages = await prisma.mediaUsage.findMany({
    where: { assetId },
    include: {
      entity: {
        select: {
          id: true,
          contentType: true,
          archived: true,
        },
      },
    },
  });

  const references = usages.map((u) => ({
    id: u.id,
    surface: u.surface,
    field: u.field,
    locale: u.locale,
    entityId: u.entityId,
    entityContentType: u.entity?.contentType || null,
  }));

  return {
    assetId,
    totalUsages: references.length,
    hasPublishedUsages: references.length > 0,
    usages: references,
  };
}

/**
 * Deletes a `MediaAsset`. `options.force` is a deliberate, narrow escape
 * hatch for operational cleanup (e.g. a usage row left dangling by a bug
 * elsewhere) and is intentionally not something any admin-reachable Server
 * Action forwards a client-supplied value into - the canonical rule is that
 * media currently in use is never deletable from the admin UI; replacing
 * its usages (`replaceMediaAssetUsage`) is the only sanctioned path to
 * freeing it up for deletion.
 */
export async function deleteMediaAsset(
  prisma: PrismaClient,
  id: string,
  context: AdminContext,
  options?: { force?: boolean }
): Promise<boolean> {
  assertAdminContext(context);

  const asset = await prisma.mediaAsset.findUnique({
    where: { id },
    include: {
      usages: {
        include: {
          entity: {
            select: { id: true, contentType: true },
          },
        },
      },
    },
  });

  if (!asset) {
    throw new MediaError("notFound", `MediaAsset with ID '${id}' not found.`);
  }

  // Check for existing usages
  if (asset.usages.length > 0 && !options?.force) {
    const report = await getMediaUsageReport(prisma, id);
    throw new MediaDependencyError(
      `Cannot delete media asset '${asset.filename}' because it is currently used by ${asset.usages.length} content item(s). Use replacement or archive instead.`,
      report
    );
  }

  // Perform database delete in transaction
  await prisma.$transaction(async (tx) => {
    if (asset.usages.length > 0) {
      await tx.mediaUsage.deleteMany({ where: { assetId: id } });
    }

    await tx.mediaAsset.delete({ where: { id } });

    await tx.auditLog.create({
      data: {
        action: "media.delete",
        entity: "MediaAsset",
        entityId: id,
        userId: context.actorId,
        metadata: {
          filename: asset.filename,
          objectKey: asset.objectKey,
          deletedUsagesCount: asset.usages.length,
        },
      },
    });
  });

  // Delete physical file from storage
  const storage = getStorageProvider();
  await storage.delete(asset.objectKey).catch(() => {
    // Storage deletion failure is logged but doesn't roll back database state
  });

  return true;
}

/**
 * Atomically moves every `MediaUsage` pointer from `oldAssetId` to
 * `newAssetId` and, when requested, archives the old asset - all inside a
 * single transaction so a failure never leaves usages split across the two
 * assets (Story 4.3's replace-and-archive contract). Both assets are
 * re-validated inside the transaction, not just before it, to close the
 * TOCTOU window where a concurrent request could delete either row between
 * the initial lookup and the write.
 */
export async function replaceMediaAssetUsage(
  prisma: PrismaClient,
  input: {
    oldAssetId: string;
    newAssetId: string;
    archiveOld?: boolean;
  },
  context: AdminContext
): Promise<MediaUsageReport> {
  assertAdminContext(context);

  if (input.oldAssetId === input.newAssetId) {
    throw new MediaError("invalidInput", "Replacement asset must differ from the asset being replaced.");
  }

  await prisma.$transaction(async (tx) => {
    const [oldAsset, newAsset] = await Promise.all([
      tx.mediaAsset.findUnique({ where: { id: input.oldAssetId } }),
      tx.mediaAsset.findUnique({ where: { id: input.newAssetId } }),
    ]);

    if (!oldAsset) {
      throw new MediaError("notFound", `Source asset '${input.oldAssetId}' not found.`);
    }
    if (!newAsset) {
      throw new MediaError("notFound", `Target replacement asset '${input.newAssetId}' not found.`);
    }
    if (newAsset.archivedAt !== null) {
      throw new MediaError(
        "invalidInput",
        `Replacement asset '${newAsset.filename}' is archived and cannot receive usages.`
      );
    }

    await tx.mediaUsage.updateMany({
      where: { assetId: input.oldAssetId },
      data: { assetId: input.newAssetId },
    });

    if (input.archiveOld && oldAsset.archivedAt === null) {
      await tx.mediaAsset.update({
        where: { id: input.oldAssetId },
        data: { archivedAt: new Date() },
      });
    }

    await tx.auditLog.create({
      data: {
        action: "media.replaceUsage",
        entity: "MediaAsset",
        entityId: input.oldAssetId,
        userId: context.actorId,
        metadata: {
          oldAssetId: input.oldAssetId,
          newAssetId: input.newAssetId,
          archiveOld: Boolean(input.archiveOld),
        },
      },
    });
  });

  return getMediaUsageReport(prisma, input.newAssetId);
}

export async function recordMediaUsage(
  prisma: PrismaClient,
  input: {
    assetId: string;
    entityId?: string | null;
    surface: string;
    field: string;
    locale?: ContentLocale | null;
    altText?: string | null;
    caption?: string | null;
  }
): Promise<MediaUsageDto> {
  const asset = await prisma.mediaAsset.findUnique({ where: { id: input.assetId } });
  if (!asset) {
    throw new MediaError("notFound", `MediaAsset '${input.assetId}' not found.`);
  }

  const usage = await prisma.mediaUsage.create({
    data: {
      assetId: input.assetId,
      entityId: input.entityId || null,
      surface: input.surface,
      field: input.field,
      locale: input.locale || null,
      altText: input.altText?.trim() || null,
      caption: input.caption?.trim() || null,
    },
  });

  return {
    id: usage.id,
    assetId: usage.assetId,
    entityId: usage.entityId,
    surface: usage.surface,
    field: usage.field,
    locale: usage.locale,
    altText: usage.altText,
    caption: usage.caption,
    createdAt: usage.createdAt,
    updatedAt: usage.updatedAt,
  };
}

export async function removeMediaUsage(
  prisma: PrismaClient,
  usageId: string
): Promise<boolean> {
  try {
    await prisma.mediaUsage.delete({ where: { id: usageId } });
    return true;
  } catch {
    return false;
  }
}
