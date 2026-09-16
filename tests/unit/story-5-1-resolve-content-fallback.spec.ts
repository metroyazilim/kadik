import { expect, test } from "@playwright/test";
import { resolveContentFallback } from "../../lib/content-model/public-fallback-policy";
import type { PublicTranslationProjection } from "../../lib/content-model/public-content-reader";

const NATIVE: PublicTranslationProjection = {
  entityId: "ent-1",
  locale: "en",
  publishedRevisionId: "rev-1",
  schemaVersion: 1,
  payload: { title: "Waste Audit" },
  publishedAt: new Date(),
  version: 1,
};

test.describe("Story 5.1 Unit - PublicFallbackPolicy.resolveContentFallback (CAP-1)", () => {
  test("a present native translation always decides native, regardless of locale", () => {
    for (const requestedLocale of ["tr", "en"] as const) {
      expect(resolveContentFallback(requestedLocale, NATIVE)).toEqual({ kind: "native" });
    }
  });

  test("a Turkish request with no native translation decides empty directly - Turkish is the source locale, no further fallback exists", () => {
    expect(resolveContentFallback("tr", null)).toEqual({
      kind: "empty",
      reason: "no-published-any-locale",
    });
  });

  test("any non-Turkish request with no native translation decides checkTurkish", () => {
    for (const requestedLocale of ["en"] as const) {
      expect(resolveContentFallback(requestedLocale, null)).toEqual({ kind: "checkTurkish" });
    }
  });

  test("is a pure, deterministic function - identical input always yields identical output", () => {
    expect(resolveContentFallback("en", null)).toEqual(resolveContentFallback("en", null));
    expect(resolveContentFallback("en", NATIVE)).toEqual(resolveContentFallback("en", NATIVE));
  });
});
