import { expect, test } from "@playwright/test";
import { composeHome, type ComposeHomeInput, type SectionProjectionMap } from "../../lib/content-model/home-composer";
import { HOME_SECTION_KEYS, type HomeSectionKey } from "../../lib/content-model/home-section-registry";
import { defaultHomeSectionPayload, HOME_SECTION_SCHEMA_VERSION } from "../../lib/content-model/home-section-schemas";
import type { Prisma } from "@prisma/client";

test.describe("Story 2.3 Unit - Home Composer Truth Table (CAP-1, CAP-2)", () => {
  test("CAP-1 - composeHome is pure, deterministic, and I/O-free", () => {
    const layoutPayload = HOME_SECTION_KEYS.map((key) => ({ key, enabled: true }));
    const projectionsEntries = HOME_SECTION_KEYS.map((key) => [
      key,
      {
        servedLocale: "tr" as const,
        servedRevisionId: `rev-${key}`,
        payload: defaultHomeSectionPayload(key) as unknown as Prisma.JsonValue,
        schemaVersion: HOME_SECTION_SCHEMA_VERSION,
        fallbackApplied: false,
        publishedAt: new Date(),
      },
    ]) as readonly [HomeSectionKey, any][];

    const projections = Object.fromEntries(projectionsEntries) as SectionProjectionMap;

    const input: ComposeHomeInput = {
      layoutRevisionPayload: layoutPayload,
      layoutRevisionId: "lay-1",
      sectionProjections: projections,
      requestedLocale: "tr",
      registryVersion: 1,
    };

    const res1 = composeHome(input);
    const res2 = composeHome(input);

    expect(res1).toEqual(res2);
    expect(res1.sections).toHaveLength(11);
    expect(res1.omittedSections).toHaveLength(0);
    expect(res1.cacheDependencies).toContain("home:layout");
  });

  test("CAP-2 - omission truth table handles disabled, missing content, and invalid payloads correctly", () => {
    const layoutPayload = HOME_SECTION_KEYS.map((key) => ({
      key,
      enabled: key !== "about",
    }));

    const projectionsEntries = HOME_SECTION_KEYS.map((key) => {
      if (key === "brandTrust") {
        return [key, null];
      }
      if (key === "services") {
        return [
          key,
          {
            servedLocale: "tr" as const,
            servedRevisionId: "rev-services",
            payload: { invalidField: true } as unknown as Prisma.JsonValue,
            schemaVersion: HOME_SECTION_SCHEMA_VERSION,
            fallbackApplied: false,
            publishedAt: new Date(),
          },
        ];
      }
      return [
        key,
        {
          servedLocale: "tr" as const,
          servedRevisionId: `rev-${key}`,
          payload: defaultHomeSectionPayload(key) as unknown as Prisma.JsonValue,
          schemaVersion: HOME_SECTION_SCHEMA_VERSION,
          fallbackApplied: false,
          publishedAt: new Date(),
        },
      ];
    }) as readonly [HomeSectionKey, any][];

    const projections = Object.fromEntries(projectionsEntries) as SectionProjectionMap;

    const input: ComposeHomeInput = {
      layoutRevisionPayload: layoutPayload,
      layoutRevisionId: "lay-2",
      sectionProjections: projections,
      requestedLocale: "tr",
      registryVersion: 1,
    };

    const composition = composeHome(input);

    expect(composition.sections).toHaveLength(8);
    expect(composition.omittedSections).toEqual([
      { key: "about", reason: "disabled" },
      { key: "brandTrust", reason: "missing-content" },
      { key: "services", reason: "invalid-payload" },
    ]);
  });

  test("CAP-1 - section render order follows layoutRevisionPayload's own order, not HOME_SECTION_KEYS declaration order", () => {
    // Reverse the registry's declared order in the layout payload - a
    // real admin reorder produces exactly this shape (Story 2.1's
    // `reorderedPayload`). composeHome must honor it.
    const reversedKeys = [...HOME_SECTION_KEYS].reverse();
    const layoutPayload = reversedKeys.map((key) => ({ key, enabled: true }));

    const projectionsEntries = HOME_SECTION_KEYS.map((key) => [
      key,
      {
        servedLocale: "tr" as const,
        servedRevisionId: `rev-${key}`,
        payload: defaultHomeSectionPayload(key) as unknown as Prisma.JsonValue,
        schemaVersion: HOME_SECTION_SCHEMA_VERSION,
        fallbackApplied: false,
        publishedAt: new Date(),
      },
    ]) as readonly [HomeSectionKey, any][];
    const projections = Object.fromEntries(projectionsEntries) as SectionProjectionMap;

    const composition = composeHome({
      layoutRevisionPayload: layoutPayload,
      layoutRevisionId: "lay-3",
      sectionProjections: projections,
      requestedLocale: "tr",
      registryVersion: 1,
    });

    expect(composition.sections.map((s) => s.key)).toEqual(reversedKeys);
    expect(composition.sections.map((s) => s.position)).toEqual(
      reversedKeys.map((_, i) => i),
    );
  });
});
