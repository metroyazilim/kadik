import { expect, test } from "@playwright/test";
import {
  contentAvailabilityTag,
  contentEntityTag,
  contentRevisionTag,
  navigationConfigTag,
} from "../../lib/content-model/cache-tags";
import { sanitizeCanonicalPayload } from "../../lib/content-model/sanitization";
import { richTextFieldsFor } from "../../lib/content-model/rich-text-field-registry";
import { SERVICE_FIXTURE_CONTENT_TYPE } from "../../lib/content-model/payload-validation";

test.describe("Story 5.1 Unit - shared cache-dependency tag vocabulary (CAP-3)", () => {
  test("contentEntityTag/contentAvailabilityTag/contentRevisionTag produce the documented plain colon-delimited format", () => {
    expect(contentEntityTag("ent-1")).toBe("content:entity:ent-1");
    expect(contentAvailabilityTag("ent-1", "en")).toBe("content:translation:ent-1:en:availability");
    expect(contentRevisionTag("ent-1", "en", "rev-1")).toBe(
      "content:translation:ent-1:en:revision:rev-1",
    );
  });

  test("navigationConfigTag is a single, stable, entity-independent string", () => {
    expect(navigationConfigTag()).toBe("content:navigation:config");
    expect(navigationConfigTag()).toBe(navigationConfigTag());
  });

  test("two independent call sites computing tags for the same entity/locale/revision produce byte-identical strings", () => {
    const callSiteA = [
      contentEntityTag("ent-9"),
      contentAvailabilityTag("ent-9", "en"),
      contentRevisionTag("ent-9", "en", "rev-9"),
    ];
    const callSiteB = [
      contentEntityTag("ent-9"),
      contentAvailabilityTag("ent-9", "en"),
      contentRevisionTag("ent-9", "en", "rev-9"),
    ];
    expect(callSiteA).toEqual(callSiteB);
  });
});

test.describe("Story 5.1 Unit - sanitizeCanonicalPayload defense-in-depth (CAP-2)", () => {
  test("a content type with no registered rich-text fields is a no-op, proving the mechanism is wired but harmless for today's fixture", () => {
    const payload = { title: "Atık Denetimi", slug: "atik-denetimi", category: "audit", order: 0 };
    const fields = richTextFieldsFor(SERVICE_FIXTURE_CONTENT_TYPE);
    expect(fields).toEqual([]);
    expect(sanitizeCanonicalPayload(payload, fields)).toEqual(payload);
  });

  test("a field named in richTextFieldNames is re-sanitized even if it somehow still carried disallowed markup", () => {
    const dirty = { title: "T", body: '<script>alert(1)</script><p onclick="x()">Safe</p>' };
    const result = sanitizeCanonicalPayload(dirty, ["body"]) as Record<string, unknown>;
    expect(result.body).not.toContain("<script");
    expect(result.body).not.toContain("onclick");
    expect(result.title).toBe("T");
  });

  test("re-sanitizing an already-canonical value is idempotent (no observable change)", () => {
    const alreadySafe = { body: "<p>Hello <strong>world</strong></p>" };
    const once = sanitizeCanonicalPayload(alreadySafe, ["body"]);
    const twice = sanitizeCanonicalPayload(once, ["body"]);
    expect(twice).toEqual(once);
  });

  test("a non-object payload (a JSON scalar or array) passes through unmodified rather than throwing", () => {
    expect(sanitizeCanonicalPayload("plain string" as unknown as never, ["body"])).toBe(
      "plain string",
    );
    expect(sanitizeCanonicalPayload(null, ["body"])).toBeNull();
    expect(sanitizeCanonicalPayload([1, 2, 3] as unknown as never, ["body"])).toEqual([1, 2, 3]);
  });

  test("a field not named in richTextFieldNames is left untouched even if it contains HTML-looking text", () => {
    const payload = { slug: "<not-a-tag-really>" };
    expect(sanitizeCanonicalPayload(payload, ["body"])).toEqual(payload);
  });
});
