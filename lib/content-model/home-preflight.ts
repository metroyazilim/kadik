import type { ContentLocale } from "@prisma/client";
import * as crypto from "node:crypto";
import { composeHome, type HomeComposition, type SectionProjectionMap } from "./home-composer";
import { HOME_SECTION_KEYS, type HomeSectionKey, type HomeLayoutSectionEntry } from "./home-section-registry";
import type { HomeBlockIssue } from "./home-section-schemas";

export const HOME_PREFLIGHT_LOCALE_ORDER = ["tr", "en"] as const satisfies readonly ContentLocale[];

export type HomePreflightCellOutcome = "NATIVE" | "FALLBACK_TR" | "OMITTED" | "INVALID" | "CONFLICT";

export type HomePreflightCellReason = "disabled" | "missing-content" | "invalid-payload" | "stale-draft";

/**
 * One resolved (key, locale) cell's candidate state, already fetched by
 * `home-preflight-resolver.ts` - never read from Prisma inside this file.
 */
export type HomePreflightCellMeta = Readonly<{
  entityId: string;
  translationId: string;
  translationVersion: number;
  hasPendingDraft: boolean;
  candidateRevisionId: string | null;
  candidateIsDraft: boolean;
  /** Per-block missing/media-missing findings for this cell's candidate
   * payload (Story 2.4 correction, AC: preflight shows which blocks are
   * incomplete, not just that the section as a whole is). Empty when the
   * candidate payload does not parse at all - that case is already
   * surfaced as the cell's own INVALID outcome. */
  blockIssues: readonly HomeBlockIssue[];
}>;

export type HomePreflightLayoutMeta = Readonly<{
  layoutId: string;
  layoutVersion: number;
  draftRevisionId: string | null;
  publishedRevisionId: string | null;
  hasPendingDraft: boolean;
}>;

export type HomePreflightInput = Readonly<{
  candidateLayoutPayload: readonly HomeLayoutSectionEntry[];
  candidateLayoutRevisionId: string;
  currentPublishedLayoutPayload: readonly HomeLayoutSectionEntry[] | null;
  layoutMeta: HomePreflightLayoutMeta;
  candidateProjectionsByLocale: Readonly<Record<ContentLocale, SectionProjectionMap>>;
  currentPublishedProjectionsByLocale: Readonly<Record<ContentLocale, SectionProjectionMap>>;
  cellMeta: Readonly<Record<HomeSectionKey, Readonly<Record<ContentLocale, HomePreflightCellMeta>>>>;
  registryVersion: number;
}>;

export type HomePreflightExpectedState = Readonly<{
  fingerprint: string;
  layoutRevisionId: string;
  cellRevisionIds: Readonly<Record<HomeSectionKey, Readonly<Record<ContentLocale, string | null>>>>;
}>;

export type HomePreflightCell = Readonly<{
  outcome: HomePreflightCellOutcome;
  servedLocale: ContentLocale | null;
  candidateRevisionId: string | null;
  reason?: HomePreflightCellReason;
  selected: boolean;
  blockIssues: readonly HomeBlockIssue[];
}>;

export type HomePreflightMatrix = Readonly<{
  fingerprint: string;
  computedAt: Date;
  cells: Readonly<Record<HomeSectionKey, Readonly<Record<ContentLocale, HomePreflightCell>>>>;
  layoutSelected: boolean;
  layoutConflict: boolean;
  blocked: boolean;
  blockingCells: readonly Readonly<{ key: HomeSectionKey; locale: ContentLocale; outcome: "INVALID" | "CONFLICT" }>[];
  sectionsBlockedByMissingTrSource: readonly HomeSectionKey[];
  firstTimeFallbackWarnings: readonly Readonly<{ key: HomeSectionKey; locale: ContentLocale }>[];
  layoutChanged: boolean;
  /** `composeHome`'s own `cacheDependencies` for the candidate composition,
   * per locale - informational only (AC-2.4-03's "route/cache yüzeyleri
   * anlaşılır gösterilir"); this story does not invalidate them. */
  cacheDependenciesByLocale: Readonly<Record<ContentLocale, readonly string[]>>;
}>;

export type HomePreflightFingerprintInput = Readonly<{
  layoutRevisionId: string;
  sectionRevisionIdsByKeyAndLocale: Readonly<Record<HomeSectionKey, Readonly<Record<ContentLocale, string | null>>>>;
}>;

/**
 * `crypto.createHash("sha256").update(canonicalJson, "utf8").digest("hex")`
 * over a fixed-key-order re-serialization of `input`, so two logically
 * identical inputs always hash the same regardless of object key
 * insertion order.
 */
export function computeHomePreflightFingerprint(input: HomePreflightFingerprintInput): string {
  const canonicalSections: Record<string, Record<string, string | null>> = {};
  for (const key of HOME_SECTION_KEYS) {
    const perLocale: Record<string, string | null> = {};
    for (const locale of HOME_PREFLIGHT_LOCALE_ORDER) {
      perLocale[locale] = input.sectionRevisionIdsByKeyAndLocale[key]?.[locale] ?? null;
    }
    canonicalSections[key] = perLocale;
  }
  const canonicalJson = JSON.stringify({
    layoutRevisionId: input.layoutRevisionId,
    sectionRevisionIdsByKeyAndLocale: canonicalSections,
  });
  return crypto.createHash("sha256").update(canonicalJson, "utf8").digest("hex");
}

type CellClassification = Readonly<{
  outcome: HomePreflightCellOutcome;
  servedLocale: ContentLocale | null;
  reason?: HomePreflightCellReason;
}>;

/**
 * Classifies every registry key against one `composeHome` result, per the
 * outcome truth table (mirrors `composeHome`'s, minus `CONFLICT` which is
 * a post-hoc override applied only to the candidate matrix).
 */
function classifyComposition(
  composition: HomeComposition,
): Readonly<Record<HomeSectionKey, CellClassification>> {
  const result = {} as Record<HomeSectionKey, CellClassification>;
  for (const section of composition.sections) {
    result[section.key] = {
      outcome: section.fallbackApplied ? "FALLBACK_TR" : "NATIVE",
      servedLocale: section.servedLocale,
    };
  }
  for (const omitted of composition.omittedSections) {
    result[omitted.key] = {
      outcome: omitted.reason === "invalid-payload" ? "INVALID" : "OMITTED",
      servedLocale: null,
      reason: omitted.reason,
    };
  }
  return result;
}

/** Every key classified as OMITTED - used for the "never published" baseline. */
function allOmitted(reason: HomePreflightCellReason): Readonly<Record<HomeSectionKey, CellClassification>> {
  const result = {} as Record<HomeSectionKey, CellClassification>;
  for (const key of HOME_SECTION_KEYS) {
    result[key] = { outcome: "OMITTED", servedLocale: null, reason };
  }
  return result;
}

function layoutPayloadsEqual(
  a: readonly HomeLayoutSectionEntry[],
  b: readonly HomeLayoutSectionEntry[] | null,
): boolean {
  if (b === null) return false;
  if (a.length !== b.length) return false;
  return a.every((entry, index) => entry.key === b[index]?.key && entry.enabled === b[index]?.enabled);
}

function enabledFor(payload: readonly HomeLayoutSectionEntry[] | null, key: HomeSectionKey): boolean {
  if (payload === null) return false;
  return payload.find((entry) => entry.key === key)?.enabled ?? false;
}

/**
 * PURE. Synchronous. Calls `composeHome` once per candidate locale (tr/en)
 * plus once for the non-Turkish published baseline (`en`) to compute
 * `firstTimeFallbackWarnings` - 3 calls total.
 *
 * CONFLICT semantics: a cell is only ever eligible to be flagged `CONFLICT`
 * when it is currently selected (`cellMeta[key][locale].candidateIsDraft`)
 * AND the prior `expectedState` recorded a non-null revision id for that
 * cell. `computeHomePreflightFingerprint`'s caller (this module, via
 * `runHomePublishPreflight`'s own output) records `null` for any cell that
 * is NOT selected in the matrix it came from - so a cell freshly checked
 * this round (unselected -> selected) always has a `null` prior entry and
 * is never mistaken for stale, and a cell just unchecked (selected ->
 * unselected) is skipped by the "currently selected" gate since it is no
 * longer part of what would be published. Only a cell that stays selected
 * across two renders while its underlying candidate revision id changes
 * underneath (a concurrent publish, or a second admin's draft save) trips
 * the override - exactly the race this story exists to catch.
 */
export function runHomePublishPreflight(
  input: HomePreflightInput,
  expectedState?: HomePreflightExpectedState,
): HomePreflightMatrix {
  const classificationByLocale: Record<ContentLocale, Readonly<Record<HomeSectionKey, CellClassification>>> =
    {} as Record<ContentLocale, Readonly<Record<HomeSectionKey, CellClassification>>>;
  const cacheDependenciesByLocale = {} as Record<ContentLocale, readonly string[]>;

  for (const locale of HOME_PREFLIGHT_LOCALE_ORDER) {
    const composition = composeHome({
      layoutRevisionPayload: input.candidateLayoutPayload,
      layoutRevisionId: input.candidateLayoutRevisionId,
      sectionProjections: input.candidateProjectionsByLocale[locale],
      requestedLocale: locale,
      registryVersion: input.registryVersion,
    });
    classificationByLocale[locale] = classifyComposition(composition);
    cacheDependenciesByLocale[locale] = composition.cacheDependencies;
  }

  const cells = {} as Record<HomeSectionKey, Record<ContentLocale, HomePreflightCell>>;
  const cellRevisionIds: Record<HomeSectionKey, Record<ContentLocale, string | null>> = {} as Record<
    HomeSectionKey,
    Record<ContentLocale, string | null>
  >;
  const blockingCells: Array<{ key: HomeSectionKey; locale: ContentLocale; outcome: "INVALID" | "CONFLICT" }> = [];

  for (const key of HOME_SECTION_KEYS) {
    cells[key] = {} as Record<ContentLocale, HomePreflightCell>;
    cellRevisionIds[key] = {} as Record<ContentLocale, string | null>;

    for (const locale of HOME_PREFLIGHT_LOCALE_ORDER) {
      const meta = input.cellMeta[key][locale];
      const classification = classificationByLocale[locale][key];
      const selected = meta.candidateIsDraft;

      let outcome: HomePreflightCellOutcome = classification.outcome;
      let reason = classification.reason;

      if (expectedState && selected) {
        const priorRevisionId = expectedState.cellRevisionIds[key]?.[locale] ?? null;
        if (priorRevisionId !== null && priorRevisionId !== meta.candidateRevisionId) {
          outcome = "CONFLICT";
          reason = "stale-draft";
        }
      }

      cells[key][locale] = {
        outcome,
        servedLocale: outcome === "CONFLICT" ? null : classification.servedLocale,
        candidateRevisionId: meta.candidateRevisionId,
        ...(reason ? { reason } : {}),
        selected,
        blockIssues: meta.blockIssues,
      };
      cellRevisionIds[key][locale] = selected ? meta.candidateRevisionId : null;

      if (selected && (outcome === "INVALID" || outcome === "CONFLICT")) {
        blockingCells.push({ key, locale, outcome });
      }
    }
  }

  const layoutSelected = input.layoutMeta.hasPendingDraft && input.candidateLayoutRevisionId === input.layoutMeta.draftRevisionId;
  const layoutConflict = Boolean(
    expectedState && expectedState.layoutRevisionId !== input.candidateLayoutRevisionId,
  );

  const layoutChanged = !layoutPayloadsEqual(input.candidateLayoutPayload, input.currentPublishedLayoutPayload);

  const sectionsBlockedByMissingTrSource: HomeSectionKey[] = [];
  for (const key of HOME_SECTION_KEYS) {
    const wasEnabled = enabledFor(input.currentPublishedLayoutPayload, key);
    const isEnabled = enabledFor(input.candidateLayoutPayload, key);
    if (!wasEnabled && isEnabled && cells[key].tr.outcome !== "NATIVE") {
      sectionsBlockedByMissingTrSource.push(key);
    }
  }

  const publishedClassificationByLocale: Partial<Record<ContentLocale, Readonly<Record<HomeSectionKey, CellClassification>>>> =
    {};
  for (const locale of HOME_PREFLIGHT_LOCALE_ORDER) {
    if (locale === "tr") continue;
    publishedClassificationByLocale[locale] =
      input.currentPublishedLayoutPayload === null
        ? allOmitted("missing-content")
        : classifyComposition(
            composeHome({
              layoutRevisionPayload: input.currentPublishedLayoutPayload,
              layoutRevisionId: "published-baseline",
              sectionProjections: input.currentPublishedProjectionsByLocale[locale],
              requestedLocale: locale,
              registryVersion: input.registryVersion,
            }),
          );
  }

  const firstTimeFallbackWarnings: Array<{ key: HomeSectionKey; locale: ContentLocale }> = [];
  for (const locale of HOME_PREFLIGHT_LOCALE_ORDER) {
    if (locale === "tr") continue;
    for (const key of HOME_SECTION_KEYS) {
      if (cells[key][locale].outcome !== "FALLBACK_TR") continue;
      const publishedOutcome = publishedClassificationByLocale[locale]?.[key]?.outcome;
      if (publishedOutcome !== "FALLBACK_TR") {
        firstTimeFallbackWarnings.push({ key, locale });
      }
    }
  }

  const blocked =
    blockingCells.length > 0 || layoutConflict || sectionsBlockedByMissingTrSource.length > 0;

  const fingerprint = computeHomePreflightFingerprint({
    layoutRevisionId: input.candidateLayoutRevisionId,
    sectionRevisionIdsByKeyAndLocale: cellRevisionIds,
  });

  return {
    fingerprint,
    computedAt: new Date(),
    cells,
    layoutSelected,
    layoutConflict,
    blocked,
    blockingCells,
    sectionsBlockedByMissingTrSource,
    firstTimeFallbackWarnings,
    layoutChanged,
    cacheDependenciesByLocale,
  };
}

/**
 * Derives the `HomePreflightExpectedState` a caller must round-trip to the
 * next `runHomePublishPreflight` call, from the exact matrix a render (or
 * a `confirmHomePublish` re-check) just produced. Mirrors the fingerprint
 * computation's own `selected ? candidateRevisionId : null` rule so the
 * two always agree on what "no prior expectation" looks like for a given
 * cell (see `runHomePublishPreflight`'s CONFLICT-semantics doc comment).
 */
export function buildHomePreflightExpectedState(
  matrix: HomePreflightMatrix,
  layoutRevisionId: string,
): HomePreflightExpectedState {
  const cellRevisionIds = {} as Record<HomeSectionKey, Record<ContentLocale, string | null>>;
  for (const key of HOME_SECTION_KEYS) {
    cellRevisionIds[key] = {} as Record<ContentLocale, string | null>;
    for (const locale of HOME_PREFLIGHT_LOCALE_ORDER) {
      const cell = matrix.cells[key][locale];
      cellRevisionIds[key][locale] = cell.selected ? cell.candidateRevisionId : null;
    }
  }
  return { fingerprint: matrix.fingerprint, layoutRevisionId, cellRevisionIds };
}
