import { expect, test } from "@playwright/test";
import {
  getStorageConfig,
  MemoryStorageProvider,
  R2StorageProvider,
} from "../../lib/media/storage";
import {
  DEFAULT_DOCUMENT_PLACEHOLDER,
  DEFAULT_IMAGE_PLACEHOLDER,
  resolveMediaOrFallback,
} from "../../lib/media/fallback";
import type { MediaAssetDto } from "../../lib/media/types";

test.describe("Story 4.1 Media Storage & Fallback Contracts", () => {
  test("AC-4.1-12 MemoryStorageProvider supports upload, exists, delete and presign", async () => {
    const provider = new MemoryStorageProvider("/custom-uploads");
    const testBuffer = Buffer.from("test media payload");
    const objectKey = "uploads/2026/09/sample.png";

    expect(await provider.exists(objectKey)).toBe(false);

    const uploadRes = await provider.upload({
      objectKey,
      buffer: testBuffer,
      mimeType: "image/png",
    });

    expect(uploadRes.objectKey).toBe(objectKey);
    expect(uploadRes.url).toBe(`/custom-uploads/${objectKey}`);
    expect(await provider.exists(objectKey)).toBe(true);
    expect(provider.getBuffer(objectKey)).toEqual(testBuffer);

    const presigned = await provider.getPresignedUploadUrl(objectKey, "image/png", 600);
    expect(presigned.objectKey).toBe(objectKey);
    expect(presigned.method).toBe("PUT");
    expect(presigned.headers["Content-Type"]).toBe("image/png");
    expect(presigned.uploadUrl).toContain(encodeURIComponent(objectKey));

    const deleted = await provider.delete(objectKey);
    expect(deleted).toBe(true);
    expect(await provider.exists(objectKey)).toBe(false);
  });

  test("AC-4.1-13 R2StorageProvider generates valid SigV4 presigned upload URLs", async () => {
    const provider = new R2StorageProvider({
      accountId: "test-account-id-12345",
      accessKeyId: "test-access-key-id",
      secretAccessKey: "test-secret-access-key-very-secret",
      bucketName: "metro-bucket",
      publicBaseUrl: "https://media.example-starter.com",
      isConfigured: true,
    });

    const objectKey = "uploads/2026/09/hero.jpg";
    const presigned = await provider.getPresignedUploadUrl(objectKey, "image/jpeg", 900);

    expect(presigned.objectKey).toBe(objectKey);
    expect(presigned.publicUrl).toBe(`https://media.example-starter.com/${objectKey}`);
    expect(presigned.method).toBe("PUT");
    expect(presigned.expiresInSeconds).toBe(900);

    // Verify SigV4 parameters in URL
    const url = new URL(presigned.uploadUrl);
    expect(url.hostname).toBe("test-account-id-12345.r2.cloudflarestorage.com");
    expect(url.pathname).toBe(`/metro-bucket/${objectKey}`);
    expect(url.searchParams.get("X-Amz-Algorithm")).toBe("AWS4-HMAC-SHA256");
    expect(url.searchParams.get("X-Amz-Credential")).toContain("test-access-key-id");
    expect(url.searchParams.get("X-Amz-Expires")).toBe("900");
    expect(url.searchParams.get("X-Amz-Signature")).toBeTruthy();

    // Invariant: Secret key MUST NEVER appear in raw URL, headers or outputs
    expect(presigned.uploadUrl).not.toContain("test-secret-access-key-very-secret");
  });

  test("AC-4.1-14 resolveMediaOrFallback resolves valid image asset correctly", () => {
    const asset: MediaAssetDto = {
      id: "med_123",
      filename: "photo.jpg",
      objectKey: "uploads/2026/09/photo.jpg",
      url: "https://media.example-starter.com/uploads/2026/09/photo.jpg",
      mimeType: "image/jpeg",
      extension: ".jpg",
      byteSize: 102400,
      width: 800,
      height: 600,
      checksum: "abc123456",
      altText: "A corporate building",
      caption: "Headquarters",
      archived: false,
      archivedAt: null,
      storageStatus: "ACTIVE",
      createdBy: "usr_admin",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const resolved = resolveMediaOrFallback(asset);
    expect(resolved.url).toBe("https://media.example-starter.com/uploads/2026/09/photo.jpg");
    expect(resolved.altText).toBe("A corporate building");
    expect(resolved.caption).toBe("Headquarters");
    expect(resolved.width).toBe(800);
    expect(resolved.height).toBe(600);
    expect(resolved.isFallback).toBe(false);
    expect(resolved.kind).toBe("image");
  });

  test("AC-4.1-15 resolveMediaOrFallback provides accessible fallback for missing/broken asset", () => {
    // Null asset
    const imgFallback = resolveMediaOrFallback(null, { fallbackKind: "image" });
    expect(imgFallback.url).toBe(DEFAULT_IMAGE_PLACEHOLDER);
    expect(imgFallback.isFallback).toBe(true);
    expect(imgFallback.altText).toBe("Görsel");
    expect(imgFallback.kind).toBe("image");

    // Null PDF document
    const docFallback = resolveMediaOrFallback(null, { fallbackKind: "document" });
    expect(docFallback.url).toBe(DEFAULT_DOCUMENT_PLACEHOLDER);
    expect(docFallback.isFallback).toBe(true);
    expect(docFallback.altText).toBe("Belge");
    expect(docFallback.kind).toBe("document");

    // Empty string
    const emptyFallback = resolveMediaOrFallback("");
    expect(emptyFallback.isFallback).toBe(true);
    expect(emptyFallback.url).toBe(DEFAULT_IMAGE_PLACEHOLDER);
  });
  test("AC-4.3-04 resolveMediaOrFallback treats an archived or storage-MISSING MediaAssetDto as broken", () => {
    const base: MediaAssetDto = {
      id: "med_456",
      filename: "old-hero.jpg",
      objectKey: "uploads/2026/09/old-hero.jpg",
      url: "https://media.example-starter.com/uploads/2026/09/old-hero.jpg",
      mimeType: "image/jpeg",
      extension: ".jpg",
      byteSize: 51200,
      width: 640,
      height: 480,
      checksum: "def789",
      altText: "Old hero image",
      caption: null,
      archived: true,
      archivedAt: new Date("2026-09-01T00:00:00Z"),
      storageStatus: "ACTIVE",
      createdBy: "usr_admin",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const archivedResolved = resolveMediaOrFallback(base);
    expect(archivedResolved.isFallback).toBe(true);
    expect(archivedResolved.url).toBe(DEFAULT_IMAGE_PLACEHOLDER);
    // The real (now-invalid) storage URL and admin-only archival timestamp
    // must never leak into the resolved public/preview view.
    expect(archivedResolved).not.toHaveProperty("archivedAt");
    expect(JSON.stringify(archivedResolved)).not.toContain("old-hero.jpg");

    const missingStorageResolved = resolveMediaOrFallback({
      ...base,
      archived: false,
      archivedAt: null,
      storageStatus: "MISSING",
    });
    expect(missingStorageResolved.isFallback).toBe(true);
    expect(missingStorageResolved.url).toBe(DEFAULT_IMAGE_PLACEHOLDER);
  });

  test("AC-4.1-16 resolveMediaOrFallback handles plain string URL gracefully", () => {
    const resolved = resolveMediaOrFallback("/assets/images/service-1.jpg", {
      defaultAlt: "Hizmet 1",
    });
    expect(resolved.url).toBe("/assets/images/service-1.jpg");
    expect(resolved.altText).toBe("Hizmet 1");
    expect(resolved.isFallback).toBe(false);
    expect(resolved.kind).toBe("image");

    const pdfResolved = resolveMediaOrFallback("/docs/catalog.pdf", {
      defaultAlt: "Ürün Kataloğu",
    });
    expect(pdfResolved.url).toBe("/docs/catalog.pdf");
    expect(pdfResolved.kind).toBe("document");
    expect(pdfResolved.mimeType).toBe("application/pdf");
  });
});
