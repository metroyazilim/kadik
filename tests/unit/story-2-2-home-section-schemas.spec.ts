import { expect, test } from "@playwright/test";
import {
  HOME_SECTION_KEYS,
} from "../../lib/content-model/home-section-registry";
import {
  createDefaultHomeBlock,
  defaultHomeSectionPayload,
  homeSectionMediaAssetIds,
  HOME_SECTION_SCHEMA_VERSION,
  inspectHomeSectionBlocks,
  inspectRawHomeBlocksForDisplay,
  parseHomeBlocksForRender,
  validateHomeSectionPayload,
  type HomeBlock,
} from "../../lib/content-model/home-section-schemas";
import {
  sanitizeRichHtml,
  stripHtmlToText,
  validateAndSanitizeRichText,
} from "../../lib/content-model/sanitization";
import { ContentModelError } from "../../lib/content-model/errors";
import { validatePayload } from "../../lib/content-model/payload-validation";

test.describe("Story 2.2 - HTML Sanitization & RichText Safety", () => {
  test("sanitizeRichHtml strips scripts, styles, iframes, and dangerous attributes", () => {
    const malicious = `
      <p>Hello <script>alert('xss')</script><strong>World</strong></p>
      <iframe src="https://evil.com"></iframe>
      <a href="javascript:alert(1)" onclick="stealCookies()">Click me</a>
      <span style="color:red" onmouseover="attack()">Text</span>
      <br>
    `;

    const clean = sanitizeRichHtml(malicious);

    expect(clean).not.toContain("<script>");
    expect(clean).not.toContain("alert");
    expect(clean).not.toContain("<iframe>");
    expect(clean).not.toContain("onclick");
    expect(clean).not.toContain("onmouseover");
    expect(clean).not.toContain("style=");
    expect(clean).toContain("<p>Hello <strong>World</strong></p>");
    expect(clean).toContain("<a>Click me</a>");
    expect(clean).toContain("<span>Text</span>");
    expect(clean).toContain("<br />");
  });

  test("sanitizeRichHtml preserves safe links with https, http, mailto, tel, and relative URLs", () => {
    const safeHtml = `
      <p>Visit <a href="https://example.com" target="_blank">External</a> or <a href="/services">Services</a> or <a href="mailto:info@metro.com">Mail</a></p>
    `;

    const clean = sanitizeRichHtml(safeHtml);
    expect(clean).toContain('<a href="https://example.com" target="_blank" rel="noopener noreferrer">External</a>');
    expect(clean).toContain('<a href="/services">Services</a>');
    expect(clean).toContain('<a href="mailto:info@metro.com">Mail</a>');
  });

  test("validateAndSanitizeRichText throws on empty or excessively long rich text", () => {
    expect(() => validateAndSanitizeRichText("<p>   <br> </p>", "text", 500, true)).toThrow(
      ContentModelError,
    );

    const longText = "a".repeat(600);
    expect(() => validateAndSanitizeRichText(`<p>${longText}</p>`, "text", 500, true)).toThrow(
      ContentModelError,
    );
  });

  test("stripHtmlToText returns clean plain text", () => {
    expect(stripHtmlToText("<p>Hello <strong>World</strong> &amp; <br /> friends</p>")).toBe(
      "Hello World &amp; friends",
    );
  });
});

test.describe("Story 2.2 correction - Home Section Block Schemas & Validators", () => {
  test("defaultHomeSectionPayload produces valid payloads for all 11 keys", () => {
    for (const key of HOME_SECTION_KEYS) {
      const def = defaultHomeSectionPayload(key);
      expect(def).toBeDefined();

      const validated = validateHomeSectionPayload(key, HOME_SECTION_SCHEMA_VERSION, def);
      expect(validated.blocks).toHaveLength(1);
    }
  });

  test("validatePayload dispatches home-section:<key> content types with sanitization", () => {
    const rawPayload = {
      blocks: [
        {
          id: "block-1",
          type: "text",
          visible: true,
          html: "<p>Safe text with <strong>bold</strong> <script>bad()</script></p>",
        },
      ],
    };

    const validated = validatePayload("home-section:hero", HOME_SECTION_SCHEMA_VERSION, rawPayload) as {
      blocks: HomeBlock[];
    };
    const [block] = validated.blocks;
    expect(block.type).toBe("text");
    if (block.type === "text") {
      expect(block.html).toBe("<p>Safe text with <strong>bold</strong> </p>");
      expect(block.html).not.toContain("<script>");
    }
  });

  test("validateHomeSectionPayload rejects invalid schema versions", () => {
    const def = defaultHomeSectionPayload("hero");
    expect(() => validateHomeSectionPayload("hero", 999, def)).toThrow(ContentModelError);
  });

  test("validateHomeSectionPayload accepts a widget-only section and rejects a non-object payload", () => {
    expect(() => validateHomeSectionPayload("hero", HOME_SECTION_SCHEMA_VERSION, null)).toThrow(
      ContentModelError,
    );
    expect(
      validateHomeSectionPayload("hero", HOME_SECTION_SCHEMA_VERSION, {
        blocks: [],
        widget: { partType: "hero", title: "Editable hero" },
      }),
    ).toMatchObject({ blocks: [], widget: { partType: "hero", title: "Editable hero" } });
  });

  test("validateHomeSectionPayload rejects duplicate block ids and an unknown block type", () => {
    expect(() =>
      validateHomeSectionPayload("hero", HOME_SECTION_SCHEMA_VERSION, {
        blocks: [
          { id: "dup", type: "kpi", visible: true, label: "A", value: "1", supportingText: "" },
          { id: "dup", type: "kpi", visible: true, label: "B", value: "2", supportingText: "" },
        ],
      }),
    ).toThrow(ContentModelError);

    expect(() =>
      validateHomeSectionPayload("hero", HOME_SECTION_SCHEMA_VERSION, {
        blocks: [{ id: "x", type: "carousel", visible: true }],
      }),
    ).toThrow(ContentModelError);
  });

  test("each of the 5 block types validates its own required fields", () => {
    // KPI requires label and value.
    expect(() =>
      validateHomeSectionPayload("achievements", HOME_SECTION_SCHEMA_VERSION, {
        blocks: [{ id: "k1", type: "kpi", visible: true, label: "", value: "250+", supportingText: "" }],
      }),
    ).toThrow(ContentModelError);

    // Banner requires a non-empty title; body/cta/mediaAssetId are optional.
    const banner = validateHomeSectionPayload("hero", HOME_SECTION_SCHEMA_VERSION, {
      blocks: [
        { id: "b1", type: "banner", visible: true, title: "Kampanya", body: "", cta: null, mediaAssetId: null },
      ],
    });
    expect(banner.blocks).toHaveLength(1);
    expect(() =>
      validateHomeSectionPayload("hero", HOME_SECTION_SCHEMA_VERSION, {
        blocks: [{ id: "b2", type: "banner", visible: true, title: "", body: "", cta: null, mediaAssetId: null }],
      }),
    ).toThrow(ContentModelError);

    // Quote requires quote + authorName... err, quote + source is optional, quote is required.
    expect(() =>
      validateHomeSectionPayload("testimonials", HOME_SECTION_SCHEMA_VERSION, {
        blocks: [{ id: "q1", type: "quote", visible: true, quote: "", source: "", mediaAssetId: null }],
      }),
    ).toThrow(ContentModelError);
  });

  test("image/banner/quote blocks accept a null media reference before it is ever set", () => {
    const validated = validateHomeSectionPayload("hero", HOME_SECTION_SCHEMA_VERSION, {
      blocks: [{ id: "img-1", type: "image", visible: true, assetId: null, altText: "" }],
    });
    expect(validated.blocks[0]).toMatchObject({ type: "image", assetId: null });
  });

  test("createDefaultHomeBlock produces a shape matching each type's schema field set", () => {
    for (const type of ["text", "image", "kpi", "banner", "quote"] as const) {
      const block = createDefaultHomeBlock(type, `default-${type}`);
      expect(block.type).toBe(type);
      expect(block.visible).toBe(true);
    }
  });

  test("homeSectionMediaAssetIds collects every referenced asset id across block types, skipping nulls", () => {
    const payload = validateHomeSectionPayload("hero", HOME_SECTION_SCHEMA_VERSION, {
      blocks: [
        { id: "i1", type: "image", visible: true, assetId: "asset-1", altText: "" },
        { id: "i2", type: "image", visible: true, assetId: null, altText: "" },
        { id: "b1", type: "banner", visible: true, title: "T", body: "", cta: null, mediaAssetId: "asset-2" },
        { id: "q1", type: "quote", visible: true, quote: "Q", source: "", mediaAssetId: "asset-1" },
        { id: "k1", type: "kpi", visible: true, label: "L", value: "V", supportingText: "" },
      ],
      widget: { partType: "hero", bgImageAssetId: "asset-3" },
    });
    expect(new Set(homeSectionMediaAssetIds(payload))).toEqual(
      new Set(["asset-1", "asset-2", "asset-3"]),
    );
  });

  test("inspectHomeSectionBlocks flags a missing (null) and a media-missing (stale) reference, never a hidden block", () => {
    const payload = validateHomeSectionPayload("hero", HOME_SECTION_SCHEMA_VERSION, {
      blocks: [
        { id: "i-missing", type: "image", visible: true, assetId: null, altText: "" },
        { id: "i-stale", type: "image", visible: true, assetId: "gone", altText: "" },
        { id: "i-ok", type: "image", visible: true, assetId: "alive", altText: "" },
        { id: "i-hidden", type: "image", visible: false, assetId: null, altText: "" },
        { id: "text-1", type: "text", visible: true, html: "<p>hi</p>" },
      ],
    });
    const issues = inspectHomeSectionBlocks(payload, new Set(["alive"]));
    expect(issues).toEqual(
      expect.arrayContaining([
        { blockId: "i-missing", blockType: "image", kind: "missing" },
        { blockId: "i-stale", blockType: "image", kind: "media-missing" },
      ]),
    );
    expect(issues.find((issue) => issue.blockId === "i-ok")).toBeUndefined();
    expect(issues.find((issue) => issue.blockId === "i-hidden")).toBeUndefined();
  });

  test("inspectRawHomeBlocksForDisplay reports which raw block index/id failed its own schema", () => {
    const problems = inspectRawHomeBlocksForDisplay({
      blocks: [
        { id: "ok-1", type: "kpi", visible: true, label: "L", value: "V", supportingText: "" },
        { id: "bad-1", type: "kpi", visible: true, label: "", value: "V", supportingText: "" },
      ],
    });
    expect(problems).toHaveLength(1);
    expect(problems[0].blockId).toBe("bad-1");
  });

  test("parseHomeBlocksForRender is key-agnostic and fails safe (empty array) on garbage input", () => {
    const payload = defaultHomeSectionPayload("hero");
    expect(parseHomeBlocksForRender(payload)).toHaveLength(1);
    expect(parseHomeBlocksForRender({ not: "a payload" })).toEqual([]);
    expect(parseHomeBlocksForRender(null)).toEqual([]);
  });
});
