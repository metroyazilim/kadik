import { expect, test } from "@playwright/test";
import { resolvePublicMediaReference } from "../../lib/content-model/public-media-resolver";
import { DEFAULT_IMAGE_PLACEHOLDER } from "../../lib/media/fallback";
import type { MediaAssetDto, MediaUsageDto } from "../../lib/media/types";

const R2_HOST = "pub-abc123.r2.dev";
const CUSTOM_HOST = "assets.metroyazilim.example";
const ALLOWED_HOSTS = [R2_HOST, CUSTOM_HOST];

function makeAsset(overrides: Partial<MediaAssetDto> = {}): MediaAssetDto {
  return {
    id: "asset-1",
    filename: "hero.jpg",
    objectKey: "services/hero.jpg",
    url: `https://${R2_HOST}/services/hero.jpg`,
    mimeType: "image/jpeg",
    extension: ".jpg",
    byteSize: 1024,
    width: 800,
    height: 600,
    checksum: "abc",
    altText: "Asset-level alt",
    caption: null,
    archived: false,
    archivedAt: null,
    storageStatus: "ACTIVE",
    createdBy: "admin-1",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeUsage(overrides: Partial<MediaUsageDto> = {}): MediaUsageDto {
  return {
    id: "usage-1",
    assetId: "asset-1",
    entityId: "ent-1",
    surface: "service",
    field: "image",
    locale: "en",
    altText: "Locale-specific alt",
    caption: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

test.describe("Story 5 Unit - public media resolution (Medya yalnız MediaAsset üzerinden çözülecek)", () => {
  test("a verified-origin asset resolves with its real URL and originVerified:true", () => {
    const resolved = resolvePublicMediaReference({ asset: makeAsset(), usage: null }, ALLOWED_HOSTS);
    expect(resolved.originVerified).toBe(true);
    expect(resolved.isFallback).toBe(false);
    expect(resolved.url).toBe(`https://${R2_HOST}/services/hero.jpg`);
  });

  test("a custom-domain URL matching the allowlist is also accepted", () => {
    const asset = makeAsset({ url: `https://${CUSTOM_HOST}/hero.jpg` });
    const resolved = resolvePublicMediaReference({ asset, usage: null }, ALLOWED_HOSTS);
    expect(resolved.originVerified).toBe(true);
    expect(resolved.url).toBe(`https://${CUSTOM_HOST}/hero.jpg`);
  });

  test("an asset whose URL host is not in the allowlist falls back and never leaks the untrusted URL", () => {
    const asset = makeAsset({ url: "https://attacker.example/hero.jpg" });
    const resolved = resolvePublicMediaReference({ asset, usage: null }, ALLOWED_HOSTS);
    expect(resolved.originVerified).toBe(false);
    expect(resolved.isFallback).toBe(true);
    expect(resolved.url).toBe(DEFAULT_IMAGE_PLACEHOLDER);
    expect(resolved.url).not.toContain("attacker.example");
  });

  test("a lookalike hostname (prefix match, not exact) is rejected - similar host is not the same host", () => {
    const asset = makeAsset({ url: `https://${R2_HOST}.attacker.example/hero.jpg` });
    const resolved = resolvePublicMediaReference({ asset, usage: null }, ALLOWED_HOSTS);
    expect(resolved.originVerified).toBe(false);
    expect(resolved.isFallback).toBe(true);
  });
  test("a non-https origin is rejected even with an allowlisted hostname", () => {
    const asset = makeAsset({ url: `http://${R2_HOST}/services/hero.jpg` });
    const resolved = resolvePublicMediaReference({ asset, usage: null }, ALLOWED_HOSTS);
    expect(resolved.originVerified).toBe(false);
    expect(resolved.isFallback).toBe(true);
  });

  test("an origin carrying embedded credentials is rejected", () => {
    const asset = makeAsset({ url: `https://user:pass@${R2_HOST}/services/hero.jpg` });
    const resolved = resolvePublicMediaReference({ asset, usage: null }, ALLOWED_HOSTS);
    expect(resolved.originVerified).toBe(false);
  });

  test("an origin on a non-default port is rejected", () => {
    const asset = makeAsset({ url: `https://${R2_HOST}:8443/services/hero.jpg` });
    const resolved = resolvePublicMediaReference({ asset, usage: null }, ALLOWED_HOSTS);
    expect(resolved.originVerified).toBe(false);
  });

  test("no asset at all resolves to the broken-media fallback", () => {
    const resolved = resolvePublicMediaReference({ asset: null }, ALLOWED_HOSTS);
    expect(resolved.isFallback).toBe(true);
    expect(resolved.originVerified).toBe(false);
  });

  test("an empty allowlist rejects every origin, never accepting a URL by default", () => {
    const resolved = resolvePublicMediaReference({ asset: makeAsset(), usage: null }, []);
    expect(resolved.originVerified).toBe(false);
    expect(resolved.isFallback).toBe(true);
  });

  test("locale-specific MediaUsage.altText wins over the asset-level altText", () => {
    const resolved = resolvePublicMediaReference(
      { asset: makeAsset(), usage: makeUsage() },
      ALLOWED_HOSTS,
    );
    expect(resolved.altText).toBe("Locale-specific alt");
  });

  test("asset-level altText is used when no usage-level override is present", () => {
    const resolved = resolvePublicMediaReference({ asset: makeAsset(), usage: null }, ALLOWED_HOSTS);
    expect(resolved.altText).toBe("Asset-level alt");
  });
  test("a usage row belonging to a different asset never overrides this asset's alt text", () => {
    const resolved = resolvePublicMediaReference(
      { asset: makeAsset({ id: "asset-1" }), usage: makeUsage({ assetId: "asset-other" }) },
      ALLOWED_HOSTS,
    );
    expect(resolved.altText).toBe("Asset-level alt");
  });

  test("a usage row for a different locale than requested never overrides this locale's alt text", () => {
    const resolved = resolvePublicMediaReference(
      { asset: makeAsset(), usage: makeUsage({ locale: "tr" }) },
      ALLOWED_HOSTS,
      { locale: "en" },
    );
    expect(resolved.altText).toBe("Asset-level alt");
  });

  test("a usage row with no locale (locale-independent) still applies when a specific locale is requested", () => {
    const resolved = resolvePublicMediaReference(
      { asset: makeAsset(), usage: makeUsage({ locale: null }) },
      ALLOWED_HOSTS,
      { locale: "en" },
    );
    expect(resolved.altText).toBe("Locale-specific alt");
  });

  test("an archived asset falls back even with a verified origin, matching the admin surface's own broken-media rule", () => {
    const asset = makeAsset({ archived: true, archivedAt: new Date() });
    const resolved = resolvePublicMediaReference({ asset, usage: null }, ALLOWED_HOSTS);
    expect(resolved.isFallback).toBe(true);
  });

  test("an asset flagged storageStatus:MISSING falls back even with a verified origin", () => {
    const asset = makeAsset({ storageStatus: "MISSING" });
    const resolved = resolvePublicMediaReference({ asset, usage: null }, ALLOWED_HOSTS);
    expect(resolved.isFallback).toBe(true);
  });
});
