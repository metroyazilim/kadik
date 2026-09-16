import { expect, test } from "../support/merged-fixtures";
import type { PrismaClient } from "@prisma/client";
import { issueTestAdminContext } from "../../lib/content-model/admin-context-test-support";
import type { AdminContext } from "../../lib/content-model/admin-context";
import {
  createMediaAsset,
  finalizeMediaUpload,
  MediaError,
  requestMediaUploadTicket,
} from "../../lib/media/service";
import { validateUploadBuffer, MediaValidationError } from "../../lib/media/validation";
import { getStorageProvider, MemoryStorageProvider } from "../../lib/media/storage";
import { assertImageUrlInLibrary, assertImageUrlsInLibrary, MediaLibraryUrlError } from "../../lib/media/library-guard";

test.setTimeout(60_000);

const TEST_PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d,
  0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x01, 0x00,
  0x00, 0x00, 0x00, 0xc8,
  0x08, 0x06, 0x00, 0x00, 0x00,
  0x14, 0xe1, 0x8d, 0x72,
]);

async function bootstrapAdminContext(client: PrismaClient): Promise<AdminContext> {
  const user = await client.adminUser.create({
    data: {
      email: `media-direct-upload-${Math.random().toString(36).slice(2)}@example.com`,
      passwordHash: "unused-in-tests",
      name: "Direct Upload Test Admin",
    },
  });
  return issueTestAdminContext({ id: user.id, email: user.email });
}

/** Simulates the browser's presigned `PUT` - the one step a service-layer
 * test cannot perform for real (there is no `XMLHttpRequest` here) - by
 * writing the exact bytes straight into the shared `MemoryStorageProvider`
 * singleton under the ticket's own `objectKey`, exactly as
 * `MemoryStorageProvider.upload` would from the mock-upload route. */
async function simulateBrowserPut(objectKey: string, buffer: Buffer, mimeType: string) {
  const storage = getStorageProvider() as MemoryStorageProvider;
  await storage.upload({ objectKey, buffer, mimeType });
}

test.describe("Media/R2 lane - direct upload and library-guard contracts", () => {
  test("requestMediaUploadTicket + finalizeMediaUpload creates a MediaAsset from a client-PUT object, matching the buffered path's shape", async ({
    testDatabase,
  }) => {
    const { client } = testDatabase;
    const context = await bootstrapAdminContext(client);

    const ticket = await requestMediaUploadTicket(
      client,
      { filename: "direct-hero.png", mimeType: "image/png", byteSize: TEST_PNG.length },
      context
    );
    expect(ticket.objectKey).toBeTruthy();
    expect(ticket.method).toBe("PUT");

    // The ledger row exists and is unresolved before the browser's PUT lands.
    const pendingAttempt = await client.mediaUploadAttempt.findUniqueOrThrow({ where: { objectKey: ticket.objectKey } });
    expect(pendingAttempt.resolvedAt).toBeNull();

    await simulateBrowserPut(ticket.objectKey, TEST_PNG, "image/png");

    const asset = await finalizeMediaUpload(
      client,
      { objectKey: ticket.objectKey, originalFilename: "direct-hero.png" },
      context,
      { altText: "Direct upload hero" }
    );

    expect(asset.filename).toBe("direct-hero.png");
    expect(asset.mimeType).toBe("image/png");
    expect(asset.width).toBe(256);
    expect(asset.height).toBe(200);
    expect(asset.altText).toBe("Direct upload hero");
    expect(asset.duplicate).toBeFalsy();

    const resolvedAttempt = await client.mediaUploadAttempt.findUniqueOrThrow({ where: { objectKey: ticket.objectKey } });
    expect(resolvedAttempt.resolvedAt).not.toBeNull();

    const dbRow = await client.mediaAsset.findUniqueOrThrow({ where: { id: asset.id } });
    expect(dbRow.objectKey).toBe(ticket.objectKey);
  });

  test("finalizeMediaUpload rejects a magic-byte mismatch and cleans up the object and attempt row - a direct upload is validated exactly like a buffered one", async ({
    testDatabase,
  }) => {
    const { client } = testDatabase;
    const context = await bootstrapAdminContext(client);

    const ticket = await requestMediaUploadTicket(
      client,
      { filename: "fake.png", mimeType: "image/png", byteSize: 20 },
      context
    );

    // Claims to be PNG (by extension/ticket) but the actual bytes are not.
    await simulateBrowserPut(ticket.objectKey, Buffer.from("not-a-real-png-file-content"), "image/png");

    await expect(
      finalizeMediaUpload(client, { objectKey: ticket.objectKey, originalFilename: "fake.png" }, context)
    ).rejects.toThrow(MediaValidationError);

    const storage = getStorageProvider() as MemoryStorageProvider;
    expect(await storage.exists(ticket.objectKey)).toBe(false);

    const attempt = await client.mediaUploadAttempt.findUnique({ where: { objectKey: ticket.objectKey } });
    expect(attempt).toBeNull();

    const assetCount = await client.mediaAsset.count({ where: { objectKey: ticket.objectKey } });
    expect(assetCount).toBe(0);
  });

  test("finalizeMediaUpload short-circuits on a checksum match, returns the existing asset with duplicate:true, and deletes the redundant object", async ({
    testDatabase,
  }) => {
    const { client } = testDatabase;
    const context = await bootstrapAdminContext(client);

    const validated = validateUploadBuffer(TEST_PNG, "already-uploaded.png", "image/png");
    const first = await createMediaAsset(client, validated, context, { altText: "Original" });

    const ticket = await requestMediaUploadTicket(
      client,
      { filename: "same-bytes-again.png", mimeType: "image/png", byteSize: TEST_PNG.length },
      context
    );
    await simulateBrowserPut(ticket.objectKey, TEST_PNG, "image/png");

    const second = await finalizeMediaUpload(
      client,
      { objectKey: ticket.objectKey, originalFilename: "same-bytes-again.png" },
      context
    );

    expect(second.duplicate).toBe(true);
    expect(second.id).toBe(first.id);
    expect(second.altText).toBe("Original");

    const storage = getStorageProvider() as MemoryStorageProvider;
    expect(await storage.exists(ticket.objectKey)).toBe(false);

    const attempt = await client.mediaUploadAttempt.findUnique({ where: { objectKey: ticket.objectKey } });
    expect(attempt).toBeNull();

    const rowCount = await client.mediaAsset.count({ where: { checksum: first.checksum } });
    expect(rowCount).toBe(1);
  });

  test("finalizeMediaUpload rejects an unknown or already-resolved objectKey without touching storage", async ({
    testDatabase,
  }) => {
    const { client } = testDatabase;
    const context = await bootstrapAdminContext(client);

    await expect(
      finalizeMediaUpload(client, { objectKey: "uploads/2026/01/never-issued.png", originalFilename: "x.png" }, context)
    ).rejects.toThrow(MediaError);

    // A ticket that already resolved (e.g. a duplicate finalize call) is rejected too.
    const ticket = await requestMediaUploadTicket(
      client,
      { filename: "resolve-once.png", mimeType: "image/png", byteSize: TEST_PNG.length },
      context
    );
    await simulateBrowserPut(ticket.objectKey, TEST_PNG, "image/png");
    await finalizeMediaUpload(client, { objectKey: ticket.objectKey, originalFilename: "resolve-once.png" }, context);

    await expect(
      finalizeMediaUpload(client, { objectKey: ticket.objectKey, originalFilename: "resolve-once.png" }, context)
    ).rejects.toThrow(MediaError);
  });

  test("requestMediaUploadTicket rejects an implausible claim (extension/MIME mismatch, oversized) before any MediaUploadAttempt row exists", async ({
    testDatabase,
  }) => {
    const { client } = testDatabase;
    const context = await bootstrapAdminContext(client);

    await expect(
      requestMediaUploadTicket(client, { filename: "photo.png", mimeType: "application/pdf", byteSize: 1000 }, context)
    ).rejects.toThrow(MediaError);

    await expect(
      requestMediaUploadTicket(client, { filename: "huge.png", mimeType: "image/png", byteSize: 50 * 1024 * 1024 }, context)
    ).rejects.toThrow(MediaError);

    const attemptCount = await client.mediaUploadAttempt.count();
    expect(attemptCount).toBe(0);
  });

  test("assertImageUrlInLibrary/assertImageUrlsInLibrary accept only active MediaAsset urls - null/empty pass, unknown and archived urls reject", async ({
    testDatabase,
  }) => {
    const { client } = testDatabase;
    const context = await bootstrapAdminContext(client);

    const validated = validateUploadBuffer(TEST_PNG, "guard-target.png", "image/png");
    const asset = await createMediaAsset(client, validated, context);

    await expect(assertImageUrlInLibrary(client, null)).resolves.toBeUndefined();
    await expect(assertImageUrlInLibrary(client, "")).resolves.toBeUndefined();
    await expect(assertImageUrlInLibrary(client, "  ")).resolves.toBeUndefined();
    await expect(assertImageUrlInLibrary(client, asset.url)).resolves.toBeUndefined();
    await expect(assertImageUrlInLibrary(client, "https://evil.example.com/not-in-library.png")).rejects.toThrow(
      MediaLibraryUrlError
    );

    await client.mediaAsset.update({ where: { id: asset.id }, data: { archivedAt: new Date() } });
    await expect(assertImageUrlInLibrary(client, asset.url)).rejects.toThrow(MediaLibraryUrlError);

    await expect(assertImageUrlsInLibrary(client, ["", asset.url])).rejects.toThrow(MediaLibraryUrlError);
  });
});
