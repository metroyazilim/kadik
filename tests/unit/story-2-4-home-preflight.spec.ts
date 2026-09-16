import { expect, test } from "@playwright/test";
import type { ContentLocale, Prisma } from "@prisma/client";
import {
  runHomePublishPreflight,
  computeHomePreflightFingerprint,
  buildHomePreflightExpectedState,
  HOME_PREFLIGHT_LOCALE_ORDER,
  type HomePreflightInput,
  type HomePreflightCellMeta,
} from "../../lib/content-model/home-preflight";
import { HOME_SECTION_KEYS, type HomeSectionKey } from "../../lib/content-model/home-section-registry";
import { defaultHomeSectionPayload, HOME_SECTION_SCHEMA_VERSION } from "../../lib/content-model/home-section-schemas";
import type { HomeSectionProjectionInput, SectionProjectionMap } from "../../lib/content-model/home-composer";

function projectionFor(
  key: HomeSectionKey,
  locale: ContentLocale,
  revisionId: string,
  overrides: Partial<HomeSectionProjectionInput> = {},
): HomeSectionProjectionInput {
  return {
    servedLocale: locale,
    servedRevisionId: revisionId,
    payload: defaultHomeSectionPayload(key) as unknown as Prisma.JsonValue,
    schemaVersion: HOME_SECTION_SCHEMA_VERSION,
    fallbackApplied: false,
    publishedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

/** Boring baseline: every key enabled, every locale served natively from an
 * already-published, valid, unselected revision. Tests override only the
 * cells/locales/layout entries relevant to the behavior under test. */
function baseInput(overrides: Partial<HomePreflightInput> = {}): HomePreflightInput {
  const layoutPayload = HOME_SECTION_KEYS.map((key) => ({ key, enabled: true }));
  const candidateProjectionsByLocale = {} as Record<ContentLocale, SectionProjectionMap>;
  const currentPublishedProjectionsByLocale = {} as Record<ContentLocale, SectionProjectionMap>;
  const cellMeta = {} as Record<HomeSectionKey, Record<ContentLocale, HomePreflightCellMeta>>;

  for (const locale of HOME_PREFLIGHT_LOCALE_ORDER) {
    const perKeyCandidate = {} as Record<HomeSectionKey, HomeSectionProjectionInput | null>;
    const perKeyPublished = {} as Record<HomeSectionKey, HomeSectionProjectionInput | null>;
    for (const key of HOME_SECTION_KEYS) {
      const revisionId = `pub-${key}-${locale}`;
      perKeyCandidate[key] = projectionFor(key, locale, revisionId);
      perKeyPublished[key] = projectionFor(key, locale, revisionId);
    }
    candidateProjectionsByLocale[locale] = perKeyCandidate;
    currentPublishedProjectionsByLocale[locale] = perKeyPublished;
  }

  for (const key of HOME_SECTION_KEYS) {
    cellMeta[key] = {} as Record<ContentLocale, HomePreflightCellMeta>;
    for (const locale of HOME_PREFLIGHT_LOCALE_ORDER) {
      cellMeta[key][locale] = {
        entityId: `entity-${key}`,
        translationId: `t-${key}-${locale}`,
        translationVersion: 1,
        hasPendingDraft: false,
        candidateRevisionId: `pub-${key}-${locale}`,
        candidateIsDraft: false,
        blockIssues: [],
      };
    }
  }

  return {
    candidateLayoutPayload: layoutPayload,
    candidateLayoutRevisionId: "layout-rev-1",
    currentPublishedLayoutPayload: layoutPayload,
    layoutMeta: {
      layoutId: "layout-1",
      layoutVersion: 1,
      draftRevisionId: null,
      publishedRevisionId: "layout-rev-1",
      hasPendingDraft: false,
    },
    candidateProjectionsByLocale,
    currentPublishedProjectionsByLocale,
    cellMeta,
    registryVersion: 1,
    ...overrides,
  };
}

test.describe("Story 2.4 Unit - runHomePublishPreflight outcome truth table (AC-2.4-01)", () => {
  test("CAP-1 - every registry key resolves NATIVE against the boring baseline, across all 44 cells", () => {
    const matrix = runHomePublishPreflight(baseInput());
    for (const key of HOME_SECTION_KEYS) {
      for (const locale of HOME_PREFLIGHT_LOCALE_ORDER) {
        expect(matrix.cells[key][locale].outcome).toBe("NATIVE");
      }
    }
    expect(matrix.blocked).toBe(false);
  });

  test("Story 2.4 correction - a cell's blockIssues pass through verbatim from its resolver-supplied meta", () => {
    const input = baseInput();
    const issues = [{ blockId: "img-1", blockType: "image" as const, kind: "media-missing" as const }];
    const patchedCellMeta = {
      ...input.cellMeta,
      hero: { ...input.cellMeta.hero, en: { ...input.cellMeta.hero.en, blockIssues: issues } },
    };
    const matrix = runHomePublishPreflight({ ...input, cellMeta: patchedCellMeta });
    expect(matrix.cells.hero.en.blockIssues).toEqual(issues);
    expect(matrix.cells.hero.tr.blockIssues).toEqual([]);
  });

  test("CAP-1 - a disabled layout entry produces OMITTED/disabled for every locale of that key", () => {
    const input = baseInput({
      candidateLayoutPayload: HOME_SECTION_KEYS.map((key) => ({ key, enabled: key !== "hero" })),
    });
    const matrix = runHomePublishPreflight(input);
    for (const locale of HOME_PREFLIGHT_LOCALE_ORDER) {
      expect(matrix.cells.hero[locale].outcome).toBe("OMITTED");
      expect(matrix.cells.hero[locale].reason).toBe("disabled");
    }
  });

  test("CAP-1 - a null candidate projection produces OMITTED/missing-content", () => {
    const input = baseInput();
    (input.candidateProjectionsByLocale.en as Record<HomeSectionKey, HomeSectionProjectionInput | null>).about = null;
    const matrix = runHomePublishPreflight(input);
    expect(matrix.cells.about.en.outcome).toBe("OMITTED");
    expect(matrix.cells.about.en.reason).toBe("missing-content");
    expect(matrix.cells.about.tr.outcome).toBe("NATIVE");
  });

  test("CAP-1 - fallbackApplied on the projection produces FALLBACK_TR with servedLocale tr", () => {
    const input = baseInput();
    (input.candidateProjectionsByLocale.en as Record<HomeSectionKey, HomeSectionProjectionInput>).services = projectionFor(
      "services",
      "tr",
      "pub-services-tr",
      { fallbackApplied: true },
    );
    const matrix = runHomePublishPreflight(input);
    expect(matrix.cells.services.en.outcome).toBe("FALLBACK_TR");
    expect(matrix.cells.services.en.servedLocale).toBe("tr");
  });

  test("CAP-1 - a payload that fails its own schema produces INVALID", () => {
    const input = baseInput();
    (input.candidateProjectionsByLocale.en as Record<HomeSectionKey, HomeSectionProjectionInput>).team = projectionFor(
      "team",
      "en",
      "pub-team-en",
      { payload: { blocks: [{ id: "b1", type: "unknown-block" }] } as unknown as Prisma.JsonValue },
    );
    const matrix = runHomePublishPreflight(input);
    expect(matrix.cells.team.en.outcome).toBe("INVALID");
    expect(matrix.cells.team.en.reason).toBe("invalid-payload");
  });
});

test.describe("Story 2.4 Unit - fingerprint determinism and sensitivity (AC-2.4-01, AC-2.4-04)", () => {
  test("CAP-2 - identical resolved input produces identical fingerprints regardless of key order", () => {
    const ordered: Record<string, Record<string, string | null>> = {};
    const shuffled: Record<string, Record<string, string | null>> = {};
    for (const key of HOME_SECTION_KEYS) {
      ordered[key] = { tr: "a", en: "b", ru: "c", ar: "d" };
      shuffled[key] = { ar: "d", ru: "c", en: "b", tr: "a" };
    }
    const a = computeHomePreflightFingerprint({
      layoutRevisionId: "layout-1",
      sectionRevisionIdsByKeyAndLocale: ordered as never,
    });
    const b = computeHomePreflightFingerprint({
      layoutRevisionId: "layout-1",
      sectionRevisionIdsByKeyAndLocale: shuffled as never,
    });
    expect(a).toBe(b);
  });

  test("CAP-2 - changing one cell's candidate revision id changes the fingerprint", () => {
    const matrixA = runHomePublishPreflight(baseInput());
    const inputB = baseInput();
    (inputB.cellMeta.hero as Record<ContentLocale, HomePreflightCellMeta>).tr = {
      ...inputB.cellMeta.hero.tr,
      candidateIsDraft: true,
      candidateRevisionId: "draft-hero-tr",
    };
    (inputB.candidateProjectionsByLocale.tr as Record<HomeSectionKey, HomeSectionProjectionInput>).hero = projectionFor(
      "hero",
      "tr",
      "draft-hero-tr",
    );
    const matrixB = runHomePublishPreflight(inputB);
    expect(matrixA.fingerprint).not.toBe(matrixB.fingerprint);
  });
});

test.describe("Story 2.4 Unit - CONFLICT semantics (AC-2.4-04)", () => {
  function selectDraft(
    input: HomePreflightInput,
    key: HomeSectionKey,
    locale: ContentLocale,
    revisionId: string,
  ): void {
    (input.cellMeta[key] as Record<ContentLocale, HomePreflightCellMeta>)[locale] = {
      ...input.cellMeta[key][locale],
      candidateIsDraft: true,
      candidateRevisionId: revisionId,
    };
    (input.candidateProjectionsByLocale[locale] as Record<HomeSectionKey, HomeSectionProjectionInput>)[key] =
      projectionFor(key, locale, revisionId);
  }

  test("a cell selected and unchanged across two rounds stays NATIVE, never CONFLICT", () => {
    const round1 = baseInput();
    selectDraft(round1, "hero", "tr", "draft-1");
    const matrix1 = runHomePublishPreflight(round1);
    const expectedState1 = buildHomePreflightExpectedState(matrix1, round1.candidateLayoutRevisionId);

    const round2 = baseInput();
    selectDraft(round2, "hero", "tr", "draft-1");
    const matrix2 = runHomePublishPreflight(round2, expectedState1);

    expect(matrix2.cells.hero.tr.outcome).toBe("NATIVE");
  });

  test("a cell selected in round 1 whose candidate revision changes underneath trips CONFLICT in round 2", () => {
    const round1 = baseInput();
    selectDraft(round1, "hero", "tr", "draft-1");
    const matrix1 = runHomePublishPreflight(round1);
    const expectedState1 = buildHomePreflightExpectedState(matrix1, round1.candidateLayoutRevisionId);

    const round2 = baseInput();
    selectDraft(round2, "hero", "tr", "draft-2"); // someone else saved a new draft
    const matrix2 = runHomePublishPreflight(round2, expectedState1);

    expect(matrix2.cells.hero.tr.outcome).toBe("CONFLICT");
    expect(matrix2.cells.hero.tr.reason).toBe("stale-draft");
    expect(matrix2.blocked).toBe(true);
    expect(matrix2.blockingCells).toContainEqual({ key: "hero", locale: "tr", outcome: "CONFLICT" });
  });

  test("a cell newly selected this round (unselected in the prior expectedState) is never flagged CONFLICT", () => {
    const round1 = baseInput(); // nothing selected
    const matrix1 = runHomePublishPreflight(round1);
    const expectedState1 = buildHomePreflightExpectedState(matrix1, round1.candidateLayoutRevisionId);

    const round2 = baseInput();
    selectDraft(round2, "about", "tr", "draft-about-1"); // freshly checked this round
    const matrix2 = runHomePublishPreflight(round2, expectedState1);

    expect(matrix2.cells.about.tr.outcome).toBe("NATIVE");
  });

  test("a cell deselected this round (was selected in the prior expectedState) is never flagged CONFLICT", () => {
    const round1 = baseInput();
    selectDraft(round1, "hero", "tr", "draft-1");
    const matrix1 = runHomePublishPreflight(round1);
    const expectedState1 = buildHomePreflightExpectedState(matrix1, round1.candidateLayoutRevisionId);

    const round2 = baseInput(); // hero:tr unselected again -> serves the published pointer
    const matrix2 = runHomePublishPreflight(round2, expectedState1);

    expect(matrix2.cells.hero.tr.outcome).toBe("NATIVE");
    expect(matrix2.cells.hero.tr.selected).toBe(false);
  });
});

test.describe("Story 2.4 Unit - first-time fallback warnings and tr-source blocking (AC-2.4-02)", () => {
  test("CAP-3 - a section newly falling back to tr in a locale that was NATIVE under the published state is warned", () => {
    const input = baseInput();
    (input.candidateProjectionsByLocale.en as Record<HomeSectionKey, HomeSectionProjectionInput>).services = projectionFor(
      "services",
      "tr",
      "pub-services-tr",
      { fallbackApplied: true },
    );
    const matrix = runHomePublishPreflight(input);
    expect(matrix.firstTimeFallbackWarnings).toContainEqual({ key: "services", locale: "en" });
  });

  test("CAP-3 - a section that was already FALLBACK_TR under the published state is not re-warned", () => {
    const input = baseInput();
    const alreadyFallback = projectionFor("services", "tr", "pub-services-tr", { fallbackApplied: true });
    (input.candidateProjectionsByLocale.en as Record<HomeSectionKey, HomeSectionProjectionInput>).services = alreadyFallback;
    (input.currentPublishedProjectionsByLocale.en as Record<HomeSectionKey, HomeSectionProjectionInput>).services = alreadyFallback;
    const matrix = runHomePublishPreflight(input);
    expect(matrix.firstTimeFallbackWarnings).not.toContainEqual({ key: "services", locale: "en" });
  });

  test("CAP-3 - never-published Home (null published layout) treats every fallback as first-time", () => {
    const input = baseInput({ currentPublishedLayoutPayload: null });
    (input.candidateProjectionsByLocale.en as Record<HomeSectionKey, HomeSectionProjectionInput>).about = projectionFor(
      "about",
      "tr",
      "pub-about-tr",
      { fallbackApplied: true },
    );
    const matrix = runHomePublishPreflight(input);
    expect(matrix.firstTimeFallbackWarnings).toContainEqual({ key: "about", locale: "en" });
  });

  test("CAP-3 - enabling a section whose tr candidate cannot render blocks the layout change", () => {
    const input = baseInput({
      currentPublishedLayoutPayload: HOME_SECTION_KEYS.map((key) => ({ key, enabled: key !== "blog" })),
      candidateLayoutPayload: HOME_SECTION_KEYS.map((key) => ({ key, enabled: true })),
    });
    (input.candidateProjectionsByLocale.tr as Record<HomeSectionKey, HomeSectionProjectionInput | null>).blog = null;
    const matrix = runHomePublishPreflight(input);
    expect(matrix.sectionsBlockedByMissingTrSource).toEqual(["blog"]);
    expect(matrix.blocked).toBe(true);
  });

  test("CAP-3 - enabling a section whose tr candidate DOES render is not blocked", () => {
    const input = baseInput({
      currentPublishedLayoutPayload: HOME_SECTION_KEYS.map((key) => ({ key, enabled: key !== "blog" })),
      candidateLayoutPayload: HOME_SECTION_KEYS.map((key) => ({ key, enabled: true })),
    });
    const matrix = runHomePublishPreflight(input);
    expect(matrix.sectionsBlockedByMissingTrSource).toEqual([]);
  });
});

test.describe("Story 2.4 Unit - layoutChanged and purity", () => {
  test("layoutChanged is false when candidate matches the published payload exactly", () => {
    const matrix = runHomePublishPreflight(baseInput());
    expect(matrix.layoutChanged).toBe(false);
  });

  test("layoutChanged is true when the order differs even if every enabled flag is the same", () => {
    const reversed = [...HOME_SECTION_KEYS].reverse().map((key) => ({ key, enabled: true }));
    const input = baseInput({ candidateLayoutPayload: reversed });
    const matrix = runHomePublishPreflight(input);
    expect(matrix.layoutChanged).toBe(true);
  });

  test("two calls over byte-identical input produce deep-equal matrices except computedAt", () => {
    const input = baseInput();
    const m1 = runHomePublishPreflight(input);
    const m2 = runHomePublishPreflight(input);
    expect({ ...m1, computedAt: null }).toEqual({ ...m2, computedAt: null });
  });
});
