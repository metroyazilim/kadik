import { expect, test } from "../support/merged-fixtures";
import type { PrismaClient } from "@prisma/client";
import { issueTestAdminContext } from "../../lib/content-model/admin-context-test-support";
import type { AdminContext } from "../../lib/content-model/admin-context";
import {
  archiveMediaAsset,
  cleanupOrphanMediaUploads,
  createMediaAsset,
  deleteMediaAsset,
  getMediaAsset,
  getMediaUsageReport,
  listMediaAssets,
  MediaDependencyError,
  MediaError,
  recordMediaUsage,
  replaceMediaAssetUsage,
  unarchiveMediaAsset,
  updateMediaAssetMetadata,
  verifyMediaAssetStorage,
} from "../../lib/media/service";
import { validateUploadBuffer } from "../../lib/media/validation";
import { getStorageProvider, MemoryStorageProvider } from "../../lib/media/storage";
import { assertMediaAssetsExist, syncFieldMediaUsage } from "../../lib/content-model/content-media";
import { ContentModelError } from "../../lib/content-model/errors";

test.setTimeout(120_000);

// Minimal valid test PNG
const TEST_PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d,
  0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x02, 0x00, // Width = 512
  0x00, 0x00, 0x01, 0x00, // Height = 256
  0x08, 0x06, 0x00, 0x00, 0x00,
  0x14, 0xe1, 0x8d, 0x72,
]);

// Distinct-content variants (different width/height bytes -> different
// checksum) for tests that need two or three genuinely separate assets;
// the shared duplicate-detection contract (CAP-3) means re-using TEST_PNG's
// exact bytes for a "second" upload would correctly collapse to the same
// asset, which is not what those tests are exercising.
function variantPng(width: number, height: number): Buffer {
  const buf = Buffer.from(TEST_PNG);
  buf.writeUInt32BE(width, 16);
  buf.writeUInt32BE(height, 20);
  return buf;
}
const TEST_PNG_2 = variantPng(300, 200);
const TEST_PNG_3 = variantPng(150, 100);

// Minimal valid test PDF
const TEST_PDF = Buffer.from("%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n");

async function bootstrapAdminContext(client: PrismaClient): Promise<AdminContext> {
  const user = await client.adminUser.create({
    data: {
      email: `media-admin-${Math.random().toString(36).slice(2)}@example.com`,
      passwordHash: "unused-in-tests",
      name: "Media Test Admin",
    },
  });
  return issueTestAdminContext({ id: user.id, email: user.email });
}

test.describe("Story 4.1 Media Library Integration Contracts", () => {
  test("AC-4.1-17 upload creates MediaAsset, stores object, and writes audit record", async ({
    testDatabase,
  }) => {
    const { client } = testDatabase;
    const context = await bootstrapAdminContext(client);

    const validated = validateUploadBuffer(TEST_PNG, "company-hero.png", "image/png");
    const asset = await createMediaAsset(client, validated, context, {
      altText: "Metro Hero Banner",
      caption: "Main office building",
    });

    expect(asset.id).toBeTruthy();
    expect(asset.filename).toBe("company-hero.png");
    expect(asset.mimeType).toBe("image/png");
    expect(asset.width).toBe(512);
    expect(asset.height).toBe(256);
    expect(asset.altText).toBe("Metro Hero Banner");
    expect(asset.caption).toBe("Main office building");
    expect(asset.archived).toBe(false);
    expect(asset.createdBy).toBe(context.actorId);

    // Verify database row
    const dbRow = await client.mediaAsset.findUniqueOrThrow({ where: { id: asset.id } });
    expect(dbRow.filename).toBe("company-hero.png");
    expect(dbRow.byteSize).toBe(TEST_PNG.length);

    // Verify audit log
    const audit = await client.auditLog.findFirstOrThrow({
      where: { entityId: asset.id, action: "media.upload" },
    });
    expect(audit.userId).toBe(context.actorId);
    expect(audit.entity).toBe("MediaAsset");
  });

  test("AC-4.1-18 listing and filtering media assets by kind, search query and pagination", async ({
    testDatabase,
  }) => {
    const { client } = testDatabase;
    const context = await bootstrapAdminContext(client);

    const validatedPng = validateUploadBuffer(TEST_PNG, "graphic-design.png", "image/png");
    const validatedPdf = validateUploadBuffer(TEST_PDF, "annual-report.pdf", "application/pdf");

    const asset1 = await createMediaAsset(client, validatedPng, context, {
      altText: "Graphic logo artwork",
    });
    const asset2 = await createMediaAsset(client, validatedPdf, context, {
      altText: "Financial 2026 report",
    });

    // List all
    const all = await listMediaAssets(client);
    expect(all.total).toBe(2);
    expect(all.assets.map((a) => a.id)).toContain(asset1.id);
    expect(all.assets.map((a) => a.id)).toContain(asset2.id);

    // Filter images only
    const imagesOnly = await listMediaAssets(client, { kind: "image" });
    expect(imagesOnly.assets).toHaveLength(1);
    expect(imagesOnly.assets[0].id).toBe(asset1.id);

    // Filter documents only
    const docsOnly = await listMediaAssets(client, { kind: "document" });
    expect(docsOnly.assets).toHaveLength(1);
    expect(docsOnly.assets[0].id).toBe(asset2.id);

    // Query search
    const searched = await listMediaAssets(client, { query: "annual-report" });
    expect(searched.assets).toHaveLength(1);
    expect(searched.assets[0].id).toBe(asset2.id);

    // Single asset retrieval
    const retrieved = await getMediaAsset(client, asset1.id);
    expect(retrieved.id).toBe(asset1.id);
    expect(retrieved.altText).toBe("Graphic logo artwork");
  });

  test("AC-4.1-19 updates metadata and records audit log", async ({ testDatabase }) => {
    const { client } = testDatabase;
    const context = await bootstrapAdminContext(client);

    const validated = validateUploadBuffer(TEST_PNG, "photo.png", "image/png");
    const asset = await createMediaAsset(client, validated, context);

    const updated = await updateMediaAssetMetadata(
      client,
      asset.id,
      { altText: "Updated Alt Text", caption: "Updated Caption" },
      context
    );

    expect(updated.altText).toBe("Updated Alt Text");
    expect(updated.caption).toBe("Updated Caption");

    // Verify audit
    const audit = await client.auditLog.findFirstOrThrow({
      where: { entityId: asset.id, action: "media.updateMetadata" },
    });
    expect(audit.userId).toBe(context.actorId);
  });

  test("AC-4.1-20 archives and unarchives media asset", async ({ testDatabase }) => {
    const { client } = testDatabase;
    const context = await bootstrapAdminContext(client);

    const validated = validateUploadBuffer(TEST_PNG, "archive-test.png", "image/png");
    const asset = await createMediaAsset(client, validated, context);

    // Archive
    const archived = await archiveMediaAsset(client, asset.id, context);
    expect(archived.archived).toBe(true);

    const listWithoutArchived = await listMediaAssets(client, { archived: false });
    expect(listWithoutArchived.assets.find((a) => a.id === asset.id)).toBeUndefined();

    // Unarchive
    const unarchived = await unarchiveMediaAsset(client, asset.id, context);
    expect(unarchived.archived).toBe(false);
  });

  test("AC-4.1-21 deletes asset cleanly when no usages exist", async ({ testDatabase }) => {
    const { client } = testDatabase;
    const context = await bootstrapAdminContext(client);

    const validated = validateUploadBuffer(TEST_PNG, "delete-me.png", "image/png");
    const asset = await createMediaAsset(client, validated, context);

    const deleted = await deleteMediaAsset(client, asset.id, context);
    expect(deleted).toBe(true);

    const exists = await client.mediaAsset.findUnique({ where: { id: asset.id } });
    expect(exists).toBeNull();
  });

  test("AC-4.1-22 blocks deletion of asset actively used by content unless replaced", async ({
    testDatabase,
  }) => {
    const { client } = testDatabase;
    const context = await bootstrapAdminContext(client);

    // Create asset
    const validated = validateUploadBuffer(TEST_PNG, "in-use.png", "image/png");
    const asset = await createMediaAsset(client, validated, context);

    // Record usage on a service entity surface
    const entity = await client.contentEntity.create({
      data: { contentType: "service", version: 1 },
    });

    const usage = await recordMediaUsage(client, {
      assetId: asset.id,
      entityId: entity.id,
      surface: "service:hero",
      field: "coverImage",
      locale: "tr",
      altText: "Türkçe Başlık Görseli",
    });

    expect(usage.id).toBeTruthy();

    // Check usage report
    const report = await getMediaUsageReport(client, asset.id);
    expect(report.totalUsages).toBe(1);
    expect(report.usages[0].surface).toBe("service:hero");

    // Attempting delete should throw MediaDependencyError
    await expect(deleteMediaAsset(client, asset.id, context)).rejects.toThrow(
      MediaDependencyError
    );

    // Asset still exists
    expect(await client.mediaAsset.findUnique({ where: { id: asset.id } })).not.toBeNull();
  });

  test("AC-4.1-23 replaceMediaAssetUsage atomically migrates all usage references", async ({
    testDatabase,
  }) => {
    const { client } = testDatabase;
    const context = await bootstrapAdminContext(client);

    const validated1 = validateUploadBuffer(TEST_PNG, "old-hero.png", "image/png");
    const validated2 = validateUploadBuffer(TEST_PNG_2, "new-hero.png", "image/png");

    const oldAsset = await createMediaAsset(client, validated1, context);
    const newAsset = await createMediaAsset(client, validated2, context);

    const entity = await client.contentEntity.create({
      data: { contentType: "post", version: 1 },
    });

    // Record 2 usages on oldAsset
    await recordMediaUsage(client, {
      assetId: oldAsset.id,
      entityId: entity.id,
      surface: "post:cover",
      field: "coverImage",
      locale: "tr",
    });
    await recordMediaUsage(client, {
      assetId: oldAsset.id,
      entityId: entity.id,
      surface: "post:cover",
      field: "coverImage",
      locale: "en",
    });

    // Replace usage with archiveOld: true
    const report = await replaceMediaAssetUsage(
      client,
      {
        oldAssetId: oldAsset.id,
        newAssetId: newAsset.id,
        archiveOld: true,
      },
      context
    );

    expect(report.assetId).toBe(newAsset.id);
    expect(report.totalUsages).toBe(2);

    // Verify old asset has 0 usages and is archived
    const oldReport = await getMediaUsageReport(client, oldAsset.id);
    expect(oldReport.totalUsages).toBe(0);

    const oldDb = await client.mediaAsset.findUniqueOrThrow({ where: { id: oldAsset.id } });
    expect(oldDb.archivedAt).not.toBeNull();

    // Now oldAsset can be safely deleted
    const deleted = await deleteMediaAsset(client, oldAsset.id, context);
    expect(deleted).toBe(true);
  });

  test("AC-4.1-24 rejects unauthorized mutations without valid AdminContext", async ({
    testDatabase,
  }) => {
    const { client } = testDatabase;
    const fakeContext = { actorId: "attacker", actorEmail: "evil@attacker.com" } as unknown as AdminContext;

    const validated = validateUploadBuffer(TEST_PNG, "forged.png", "image/png");

    await expect(createMediaAsset(client, validated, fakeContext)).rejects.toThrow(
      ContentModelError
    );
  });

  test("AC-4.1-04 re-uploading an identical file returns the existing asset without a second row or storage write", async ({
    testDatabase,
  }) => {
    const { client } = testDatabase;
    const context = await bootstrapAdminContext(client);

    const validated1 = validateUploadBuffer(TEST_PNG, "duplicate-source.png", "image/png");
    const first = await createMediaAsset(client, validated1, context, { altText: "First upload" });
    expect(first.duplicate).toBeFalsy();

    // Same bytes, different filename - checksum match must still short-circuit.
    const validated2 = validateUploadBuffer(TEST_PNG, "duplicate-resubmit.png", "image/png");
    const second = await createMediaAsset(client, validated2, context, { altText: "Resubmitted" });

    expect(second.duplicate).toBe(true);
    expect(second.id).toBe(first.id);
    // The duplicate call must not have overwritten the original metadata.
    expect(second.altText).toBe("First upload");

    const rowCount = await client.mediaAsset.count({ where: { checksum: first.checksum } });
    expect(rowCount).toBe(1);
  });

  test("CAP-4 cleanupOrphanMediaUploads reaps a stale unresolved attempt and leaves a resolved one untouched", async ({
    testDatabase,
  }) => {
    const { client } = testDatabase;
    const context = await bootstrapAdminContext(client);

    // A real upload resolves its own attempt row - it must survive cleanup.
    const validated = validateUploadBuffer(TEST_PNG, "resolved.png", "image/png");
    const asset = await createMediaAsset(client, validated, context);
    const resolvedAttempt = await client.mediaUploadAttempt.findUniqueOrThrow({
      where: { objectKey: asset.objectKey },
    });
    expect(resolvedAttempt.resolvedAt).not.toBeNull();

    // Simulate a crash between the storage write and the DB transaction:
    // an attempt row with no corresponding MediaAsset, backdated past the
    // retention window.
    const staleObjectKey = `uploads/2020/01/orphan-${Math.random().toString(36).slice(2)}.png`;
    await client.mediaUploadAttempt.create({
      data: {
        objectKey: staleObjectKey,
        createdBy: context.actorId,
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      },
    });

    const result = await cleanupOrphanMediaUploads(client, 60 * 60 * 1000);
    expect(result.cleaned).toBe(1);
    expect(result.objectKeys).toContain(staleObjectKey);

    const remaining = await client.mediaUploadAttempt.findUnique({ where: { objectKey: staleObjectKey } });
    expect(remaining).toBeNull();

    const stillResolved = await client.mediaUploadAttempt.findUnique({ where: { objectKey: asset.objectKey } });
    expect(stillResolved).not.toBeNull();
  });

  test("CAP-4 verifyMediaAssetStorage detects an externally-deleted object and flips storageStatus to MISSING", async ({
    testDatabase,
  }) => {
    const { client } = testDatabase;
    const context = await bootstrapAdminContext(client);

    const validated = validateUploadBuffer(TEST_PNG, "verify-me.png", "image/png");
    const asset = await createMediaAsset(client, validated, context);
    expect(asset.storageStatus).toBe("ACTIVE");

    // No-op verification: nothing changed, so no write occurs.
    const before = await client.mediaAsset.findUniqueOrThrow({ where: { id: asset.id } });
    const unchanged = await verifyMediaAssetStorage(client, asset.id);
    expect(unchanged.storageStatus).toBe("ACTIVE");
    const afterNoop = await client.mediaAsset.findUniqueOrThrow({ where: { id: asset.id } });
    expect(afterNoop.updatedAt.getTime()).toBe(before.updatedAt.getTime());

    // Simulate the object vanishing from storage out-of-band.
    const storage = getStorageProvider() as MemoryStorageProvider;
    await storage.delete(asset.objectKey);

    const verified = await verifyMediaAssetStorage(client, asset.id);
    expect(verified.storageStatus).toBe("MISSING");

    const dbRow = await client.mediaAsset.findUniqueOrThrow({ where: { id: asset.id } });
    expect(dbRow.storageStatus).toBe("MISSING");
  });

  test("AC-4.3-03 replaceMediaAssetUsage rejects an archived replacement target and self-replacement before moving any usage", async ({
    testDatabase,
  }) => {
    const { client } = testDatabase;
    const context = await bootstrapAdminContext(client);

    const validatedOld = validateUploadBuffer(TEST_PNG, "guard-old.png", "image/png");
    const validatedArchived = validateUploadBuffer(TEST_PNG_2, "guard-archived-target.png", "image/png");
    const oldAsset = await createMediaAsset(client, validatedOld, context);
    const archivedTarget = await createMediaAsset(client, validatedArchived, context);
    await archiveMediaAsset(client, archivedTarget.id, context);

    const entity = await client.contentEntity.create({ data: { contentType: "post", version: 1 } });
    await recordMediaUsage(client, {
      assetId: oldAsset.id,
      entityId: entity.id,
      surface: "post:cover",
      field: "coverImage",
      locale: "tr",
    });

    await expect(
      replaceMediaAssetUsage(client, { oldAssetId: oldAsset.id, newAssetId: archivedTarget.id }, context)
    ).rejects.toThrow(MediaError);

    // Usage must still point at the original asset - nothing moved.
    const reportAfterRejectedReplace = await getMediaUsageReport(client, oldAsset.id);
    expect(reportAfterRejectedReplace.totalUsages).toBe(1);

    await expect(
      replaceMediaAssetUsage(client, { oldAssetId: oldAsset.id, newAssetId: oldAsset.id }, context)
    ).rejects.toThrow(MediaError);
  });

  test("AC-4.2 CAP-4 assertMediaAssetsExist rejects a missing id and an archived id, accepts an active one", async ({
    testDatabase,
  }) => {
    const { client } = testDatabase;
    const context = await bootstrapAdminContext(client);

    const validated = validateUploadBuffer(TEST_PNG, "trust-boundary.png", "image/png");
    const active = await createMediaAsset(client, validated, context);
    const validatedArchived = validateUploadBuffer(TEST_PNG_2, "trust-boundary-archived.png", "image/png");
    const archived = await createMediaAsset(client, validatedArchived, context);
    await archiveMediaAsset(client, archived.id, context);

    await expect(assertMediaAssetsExist(client, [active.id])).resolves.toBeUndefined();
    await expect(assertMediaAssetsExist(client, ["does-not-exist"])).rejects.toThrow(ContentModelError);
    await expect(assertMediaAssetsExist(client, [archived.id])).rejects.toThrow(ContentModelError);
    // Null/undefined/empty entries are always allowed (optional field).
    await expect(assertMediaAssetsExist(client, [null, undefined])).resolves.toBeUndefined();
  });

  test("AC-4.2 CAP-3 syncFieldMediaUsage reconciles a field's usage set to exactly the given assets", async ({
    testDatabase,
  }) => {
    const { client } = testDatabase;
    const context = await bootstrapAdminContext(client);

    const v1 = validateUploadBuffer(TEST_PNG, "gallery-1.png", "image/png");
    const v2 = validateUploadBuffer(TEST_PNG_2, "gallery-2.png", "image/png");
    const v3 = validateUploadBuffer(TEST_PNG_3, "gallery-3.png", "image/png");
    const asset1 = await createMediaAsset(client, v1, context);
    const asset2 = await createMediaAsset(client, v2, context);
    const asset3 = await createMediaAsset(client, v3, context);

    const entity = await client.contentEntity.create({ data: { contentType: "project", version: 1 } });

    await syncFieldMediaUsage(client, {
      entityId: entity.id,
      locale: "tr",
      surface: "project:gallery",
      field: "images",
      assetIds: [asset1.id, asset2.id],
    });

    let usages = await client.mediaUsage.findMany({
      where: { entityId: entity.id, surface: "project:gallery", field: "images", locale: "tr" },
    });
    expect(usages.map((u) => u.assetId).sort()).toEqual([asset1.id, asset2.id].sort());

    // Reconcile to a different set: drop asset1, keep asset2, add asset3.
    await syncFieldMediaUsage(client, {
      entityId: entity.id,
      locale: "tr",
      surface: "project:gallery",
      field: "images",
      assetIds: [asset2.id, asset3.id],
    });

    usages = await client.mediaUsage.findMany({
      where: { entityId: entity.id, surface: "project:gallery", field: "images", locale: "tr" },
    });
    expect(usages.map((u) => u.assetId).sort()).toEqual([asset2.id, asset3.id].sort());
  });
});
