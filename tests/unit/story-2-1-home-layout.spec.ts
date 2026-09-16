import { expect, test } from "@playwright/test";
import {
  HOME_SECTION_KEYS,
  HOME_LAYOUT_SCHEMA_VERSION,
  defaultHomeLayoutPayload,
  homeSectionContentType,
  homeSectionKeyFromContentType,
  isHomeSectionKey,
  validateHomeLayoutPayload,
} from "../../lib/content-model/home-section-registry";
import { ContentModelError } from "../../lib/content-model/errors";
import { reorderedPayload, visibilityTogglePayload } from "../../lib/content-model/home-layout";

test.describe("Story 2.1 registry (AC-2.1-01, AC-2.1-04)", () => {
  test("CAP-1 the registry is exactly eleven unique keys", () => {
    expect(HOME_SECTION_KEYS.length).toBe(11);
    expect(new Set(HOME_SECTION_KEYS).size).toBe(11);
  });

  test("CAP-1 isHomeSectionKey accepts only registered keys", () => {
    for (const key of HOME_SECTION_KEYS) expect(isHomeSectionKey(key)).toBe(true);
    expect(isHomeSectionKey("footer")).toBe(false);
    expect(isHomeSectionKey("SiteHeader")).toBe(false);
    expect(isHomeSectionKey(42)).toBe(false);
    expect(isHomeSectionKey(null)).toBe(false);
  });

  test("CAP-1 homeSectionContentType/homeSectionKeyFromContentType round-trip", () => {
    for (const key of HOME_SECTION_KEYS) {
      expect(homeSectionKeyFromContentType(homeSectionContentType(key))).toBe(key);
    }
    expect(homeSectionKeyFromContentType("service-fixture")).toBeNull();
    expect(homeSectionKeyFromContentType("home-section:not-a-key")).toBeNull();
  });

  test("CAP-1 defaultHomeLayoutPayload covers every key exactly once, all enabled", () => {
    const payload = defaultHomeLayoutPayload();
    expect(payload.map((entry) => entry.key)).toEqual([...HOME_SECTION_KEYS]);
    expect(payload.every((entry) => entry.enabled)).toBe(true);
  });

  test("CAP-1 validateHomeLayoutPayload accepts the default payload", () => {
    const payload = defaultHomeLayoutPayload();
    expect(validateHomeLayoutPayload(HOME_LAYOUT_SCHEMA_VERSION, payload)).toEqual(payload);
  });

  test("AC-2.1-04 rejects an unsupported schema version", () => {
    expect(() => validateHomeLayoutPayload(2, defaultHomeLayoutPayload())).toThrow(ContentModelError);
  });

  test("AC-2.1-04 rejects a non-array payload", () => {
    expect(() => validateHomeLayoutPayload(HOME_LAYOUT_SCHEMA_VERSION, { hero: true })).toThrow(
      ContentModelError,
    );
  });

  test("AC-2.1-04 rejects a payload missing a registry section", () => {
    const short = defaultHomeLayoutPayload().slice(0, 10);
    expect(() => validateHomeLayoutPayload(HOME_LAYOUT_SCHEMA_VERSION, short)).toThrow(ContentModelError);
  });

  test("AC-2.1-04 rejects a payload with a duplicate key", () => {
    const payload = defaultHomeLayoutPayload().slice(0, 10);
    const duplicated = [...payload, payload[0]];
    expect(() => validateHomeLayoutPayload(HOME_LAYOUT_SCHEMA_VERSION, duplicated)).toThrow(
      ContentModelError,
    );
  });

  test("AC-2.1-04 rejects a payload referencing a section outside the registry", () => {
    const payload = defaultHomeLayoutPayload().slice(0, 10);
    const withUnknown = [...payload, { key: "unknown-section", enabled: true }];
    expect(() => validateHomeLayoutPayload(HOME_LAYOUT_SCHEMA_VERSION, withUnknown)).toThrow(
      ContentModelError,
    );
  });

  test("AC-2.1-04 rejects a non-boolean enabled flag", () => {
    const payload = defaultHomeLayoutPayload().map((entry, index) =>
      index === 0 ? { key: entry.key, enabled: "yes" } : entry,
    );
    expect(() => validateHomeLayoutPayload(HOME_LAYOUT_SCHEMA_VERSION, payload)).toThrow(
      ContentModelError,
    );
  });

  test("AC-2.1-04 rejects a row with an unexpected extra key", () => {
    const payload = defaultHomeLayoutPayload().map((entry, index) =>
      index === 0 ? { ...entry, extra: true } : entry,
    );
    expect(() => validateHomeLayoutPayload(HOME_LAYOUT_SCHEMA_VERSION, payload)).toThrow(
      ContentModelError,
    );
  });

  test("validateHomeLayoutPayload returns a fresh array, not the caller's reference", () => {
    const payload = defaultHomeLayoutPayload();
    const result = validateHomeLayoutPayload(HOME_LAYOUT_SCHEMA_VERSION, payload);
    expect(result).not.toBe(payload);
  });
});

test.describe("Story 2.1 CAP-3 - reorder/visibility isolation", () => {
  test("AC-2.1-02/03 reorderedPayload preserves every enabled flag unchanged", () => {
    const current = defaultHomeLayoutPayload().map((entry, index) => ({
      key: entry.key,
      enabled: index % 2 === 0,
    }));
    const reversedOrder = [...HOME_SECTION_KEYS].reverse();
    const result = reorderedPayload(current, reversedOrder);
    expect(result.map((entry) => entry.key)).toEqual(reversedOrder);
    const enabledByKey = new Map(current.map((entry) => [entry.key, entry.enabled]));
    for (const entry of result) {
      expect(entry.enabled).toBe(enabledByKey.get(entry.key));
    }
  });

  test("AC-2.1-04 reorderedPayload rejects a list that is not a full permutation", () => {
    const current = defaultHomeLayoutPayload();
    expect(() => reorderedPayload(current, current.slice(0, 5).map((e) => e.key))).toThrow(
      ContentModelError,
    );
    expect(() =>
      reorderedPayload(current, [...current.map((e) => e.key), "hero"] as never),
    ).toThrow(ContentModelError);
  });

  test("AC-2.1-03 visibilityTogglePayload changes only the requested key's enabled flag", () => {
    const current = defaultHomeLayoutPayload();
    const result = visibilityTogglePayload(current, "marquee", false);
    expect(result.map((entry) => entry.key)).toEqual(current.map((entry) => entry.key));
    for (const entry of result) {
      expect(entry.enabled).toBe(entry.key === "marquee" ? false : true);
    }
  });

  test("visibilityTogglePayload rejects a key outside the registry", () => {
    const current = defaultHomeLayoutPayload();
    expect(() => visibilityTogglePayload(current, "not-a-key" as never, false)).toThrow(
      ContentModelError,
    );
  });
});
