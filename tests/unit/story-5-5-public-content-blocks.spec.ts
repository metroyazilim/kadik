import { expect, test } from "@playwright/test";
import {
  parseContentBlocks,
  resolvePublicContentBlocks,
  type ContentBlockMediaLookup,
} from "../../lib/content-model/content-blocks";
import { DEFAULT_IMAGE_PLACEHOLDER } from "../../lib/media/fallback";
import type { MediaAssetDto } from "../../lib/media/types";

const R2_HOST = "pub-abc123.r2.dev";
const ALLOWED_HOSTS = [R2_HOST];

function makeAsset(overrides: Partial<MediaAssetDto> = {}): MediaAssetDto {
  return {
    id: "asset-1",
    filename: "hero.jpg",
    objectKey: "blocks/hero.jpg",
    url: `https://${R2_HOST}/blocks/hero.jpg`,
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

function lookupOf(...assets: readonly MediaAssetDto[]): ContentBlockMediaLookup {
  return new Map(assets.map((asset) => [asset.id, { asset }]));
}

const emptyContext = { mediaLookup: new Map(), allowedMediaHosts: ALLOWED_HOSTS };

test.describe("Story 5.5 Unit - parseContentBlocks (unknown/invalid block şeması güvenli omit)", () => {
  test("a non-array candidate returns an empty list rather than throwing", () => {
    expect(parseContentBlocks(null)).toEqual([]);
    expect(parseContentBlocks(undefined)).toEqual([]);
    expect(parseContentBlocks("not-an-array")).toEqual([]);
    expect(parseContentBlocks({ type: "TEXT", html: "<p>x</p>" })).toEqual([]);
  });

  test("a well-formed block of each known type is accepted", () => {
    const raw = [
      { type: "TEXT", html: "<p>Hello</p>" },
      { type: "IMAGE", mediaAssetId: "asset-1" },
      { type: "KPI", value: "42", label: "Projeler" },
      { type: "BANNER", heading: "Kampanya" },
      { type: "QUOTE", quote: "Harika bir ekip." },
    ];
    const parsed = parseContentBlocks(raw);
    expect(parsed.map((block) => block.type)).toEqual(["TEXT", "IMAGE", "KPI", "BANNER", "QUOTE"]);
  });

  test("an unknown block type is dropped, valid siblings survive", () => {
    const raw = [
      { type: "TEXT", html: "<p>Kept</p>" },
      { type: "CAROUSEL", slides: [] },
      { type: "QUOTE", quote: "Kept too." },
    ];
    const parsed = parseContentBlocks(raw);
    expect(parsed.map((block) => block.type)).toEqual(["TEXT", "QUOTE"]);
  });

  test("a block missing a required field is dropped", () => {
    expect(parseContentBlocks([{ type: "KPI", label: "no value" }])).toEqual([]);
    expect(parseContentBlocks([{ type: "IMAGE" }])).toEqual([]);
    expect(parseContentBlocks([{ type: "QUOTE" }])).toEqual([]);
  });

  test("a block carrying an extra, unregistered key is dropped (closed shape)", () => {
    const parsed = parseContentBlocks([{ type: "TEXT", html: "<p>x</p>", trackingId: "abc" }]);
    expect(parsed).toEqual([]);
  });

  test("a BANNER with a javascript: cta href is dropped", () => {
    const parsed = parseContentBlocks([
      { type: "BANNER", heading: "Kampanya", ctaLabel: "Tıkla", ctaHref: "javascript:alert(1)" },
    ]);
    expect(parsed).toEqual([]);
  });

  test("a BANNER with a safe relative cta href is accepted", () => {
    const parsed = parseContentBlocks([
      { type: "BANNER", heading: "Kampanya", ctaLabel: "Tıkla", ctaHref: "/servisler" },
    ]);
    expect(parsed).toHaveLength(1);
  });

  test("a block whose field has the wrong type is dropped", () => {
    expect(parseContentBlocks([{ type: "KPI", value: 42, label: "sayı" }])).toEqual([]);
    expect(parseContentBlocks([{ type: "TEXT", html: 123 }])).toEqual([]);
  });

  test("only the first 60 valid blocks are kept from an oversized array", () => {
    const raw = Array.from({ length: 90 }, (_, index) => ({ type: "QUOTE", quote: `Q${index}` }));
    const parsed = parseContentBlocks(raw);
    expect(parsed).toHaveLength(60);
    expect(parsed[0]).toMatchObject({ quote: "Q0" });
  });

  test("KPI trend accepts only the closed up/down/flat set", () => {
    expect(parseContentBlocks([{ type: "KPI", value: "1", label: "x", trend: "up" }])).toHaveLength(1);
    expect(parseContentBlocks([{ type: "KPI", value: "1", label: "x", trend: "sideways" }])).toEqual([]);
  });
});

test.describe("Story 5.5 Unit - resolvePublicContentBlocks (type-safe render-ready output)", () => {
  test("TEXT is re-sanitized through sanitizeRichHtml before rendering", () => {
    const [parsed] = parseContentBlocks([{ type: "TEXT", html: "<p onclick=\"evil()\">Hi<script>bad()</script></p>" }]);
    const [resolved] = resolvePublicContentBlocks([parsed], emptyContext);
    expect(resolved).toEqual({ type: "TEXT", html: "<p>Hi</p>" });
  });

  test("a TEXT block that sanitizes down to nothing is omitted, not rendered empty", () => {
    const [parsed] = parseContentBlocks([{ type: "TEXT", html: "<script>bad()</script>   " }]);
    const resolved = resolvePublicContentBlocks([parsed], emptyContext);
    expect(resolved).toEqual([]);
  });

  test("IMAGE resolves through the verified-origin media lookup", () => {
    const asset = makeAsset();
    const [parsed] = parseContentBlocks([{ type: "IMAGE", mediaAssetId: "asset-1" }]);
    const [resolved] = resolvePublicContentBlocks([parsed], {
      mediaLookup: lookupOf(asset),
      allowedMediaHosts: ALLOWED_HOSTS,
    });
    expect(resolved).toMatchObject({ type: "IMAGE", media: { url: asset.url, originVerified: true } });
  });

  test("IMAGE with an id absent from the lookup falls back to the shared placeholder, never omitted", () => {
    const [parsed] = parseContentBlocks([{ type: "IMAGE", mediaAssetId: "missing-asset" }]);
    const [resolved] = resolvePublicContentBlocks([parsed], emptyContext);
    expect(resolved).toMatchObject({
      type: "IMAGE",
      media: { url: DEFAULT_IMAGE_PLACEHOLDER, originVerified: false },
    });
  });

  test("IMAGE with an unverified-origin asset falls back and never leaks the untrusted URL", () => {
    const asset = makeAsset({ url: "https://evil.example/steal.jpg" });
    const [parsed] = parseContentBlocks([{ type: "IMAGE", mediaAssetId: "asset-1" }]);
    const [resolved] = resolvePublicContentBlocks([parsed], {
      mediaLookup: lookupOf(asset),
      allowedMediaHosts: ALLOWED_HOSTS,
    });
    expect(resolved).toMatchObject({ media: { url: DEFAULT_IMAGE_PLACEHOLDER, originVerified: false } });
  });

  test("IMAGE's own block-level alt overrides the resolved media's alt text", () => {
    const asset = makeAsset({ altText: "Asset alt" });
    const [parsed] = parseContentBlocks([{ type: "IMAGE", mediaAssetId: "asset-1", alt: "Block-authored alt" }]);
    const [resolved] = resolvePublicContentBlocks([parsed], {
      mediaLookup: lookupOf(asset),
      allowedMediaHosts: ALLOWED_HOSTS,
    });
    expect(resolved).toMatchObject({ media: { altText: "Block-authored alt" } });
  });

  test("an archived asset referenced by an IMAGE block falls back, matching the admin surface's own rule", () => {
    const asset = makeAsset({ archived: true, archivedAt: new Date() });
    const [parsed] = parseContentBlocks([{ type: "IMAGE", mediaAssetId: "asset-1" }]);
    const [resolved] = resolvePublicContentBlocks([parsed], {
      mediaLookup: lookupOf(asset),
      allowedMediaHosts: ALLOWED_HOSTS,
    });
    // Origin was legitimately verified; only the asset itself is unusable -
    // `originVerified` tracks origin trust, not archived status, matching
    // `story-5-public-media-resolver.spec.ts`'s own precedent (asserts only
    // `isFallback`, never `originVerified`, for this exact case).
    expect(resolved).toMatchObject({ media: { url: DEFAULT_IMAGE_PLACEHOLDER, isFallback: true } });
  });

  test("KPI passes through its already-validated typed fields unchanged", () => {
    const [parsed] = parseContentBlocks([{ type: "KPI", value: "128", label: "Tamamlanan proje", unit: "adet", trend: "up" }]);
    const [resolved] = resolvePublicContentBlocks([parsed], emptyContext);
    expect(resolved).toEqual({ type: "KPI", value: "128", label: "Tamamlanan proje", unit: "adet", trend: "up" });
  });

  test("KPI omitted optional fields resolve to null, never undefined leaking into the renderable shape", () => {
    const [parsed] = parseContentBlocks([{ type: "KPI", value: "5", label: "Yıl" }]);
    const [resolved] = resolvePublicContentBlocks([parsed], emptyContext);
    expect(resolved).toEqual({ type: "KPI", value: "5", label: "Yıl", unit: null, trend: null });
  });

  test("BANNER with no mediaAssetId resolves media:null rather than a fallback placeholder", () => {
    const [parsed] = parseContentBlocks([{ type: "BANNER", heading: "Kampanya" }]);
    const [resolved] = resolvePublicContentBlocks([parsed], emptyContext);
    expect(resolved).toEqual({
      type: "BANNER",
      heading: "Kampanya",
      subheading: null,
      ctaLabel: null,
      ctaHref: null,
      media: null,
    });
  });

  test("BANNER's mediaAssetId resolves through the same verified-origin path as IMAGE", () => {
    const asset = makeAsset();
    const [parsed] = parseContentBlocks([{ type: "BANNER", heading: "Kampanya", mediaAssetId: "asset-1" }]);
    const [resolved] = resolvePublicContentBlocks([parsed], {
      mediaLookup: lookupOf(asset),
      allowedMediaHosts: ALLOWED_HOSTS,
    });
    expect(resolved).toMatchObject({ media: { url: asset.url, originVerified: true } });
  });

  test("QUOTE passes through its already-validated typed fields unchanged", () => {
    const [parsed] = parseContentBlocks([{ type: "QUOTE", quote: "Harika hizmet.", author: "Ayşe", role: "Müdür" }]);
    const [resolved] = resolvePublicContentBlocks([parsed], emptyContext);
    expect(resolved).toEqual({ type: "QUOTE", quote: "Harika hizmet.", author: "Ayşe", role: "Müdür" });
  });

  test("a mixed sequence resolves each block independently, preserving order", () => {
    const asset = makeAsset();
    const raw = [
      { type: "TEXT", html: "<p>Giriş</p>" },
      { type: "IMAGE", mediaAssetId: "asset-1" },
      { type: "UNKNOWN_TYPE", foo: "bar" },
      { type: "KPI", value: "10", label: "Yıl" },
    ];
    const parsed = parseContentBlocks(raw);
    const resolved = resolvePublicContentBlocks(parsed, { mediaLookup: lookupOf(asset), allowedMediaHosts: ALLOWED_HOSTS });
    expect(resolved.map((block) => block.type)).toEqual(["TEXT", "IMAGE", "KPI"]);
  });

  test("an empty parsed list resolves to an empty renderable list", () => {
    expect(resolvePublicContentBlocks([], emptyContext)).toEqual([]);
  });
});
