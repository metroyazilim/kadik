import type { ContentLocale, HomeSectionKey, PrismaClient } from "@prisma/client";
import { assertAdminContext, type AdminContext } from "./admin-context";
import { adminPublish } from "./admin-content-store";
import { adminPublishHomeLayout } from "./home-admin-store";
import { resolveHomePreflightInputs, type HomePreflightSelection } from "./home-preflight-resolver";
import {
  runHomePublishPreflight,
  buildHomePreflightExpectedState,
  HOME_PREFLIGHT_LOCALE_ORDER,
  type HomePreflightExpectedState,
  type HomePreflightMatrix,
} from "./home-preflight";
import { HOME_SECTION_KEYS } from "./home-section-registry";
import { persistedOutboxRecorder } from "./outbox-store";
import { contentAvailabilityTag, contentEntityTag } from "./cache-tags";

export type HomePublishPlanItemRef =
  | Readonly<{ kind: "layout" }>
  | Readonly<{ kind: "section"; key: HomeSectionKey; locale: ContentLocale }>;

export type HomePublishConfirmInput = Readonly<{
  selection: HomePreflightSelection;
  /** The `HomePreflightExpectedState` from the preflight render the admin
   * clicked "Yayınla" on - this is what gets re-verified, never trusted
   * as fact. */
  expectedState: HomePreflightExpectedState;
}>;

/**
 * Story 2.6 correction: atomic publish. There is no longer a "partial"
 * outcome - either every selected item (layout + every selected section
 * locale) publishes inside one database transaction, or none of them do.
 * A mid-batch conflict (a concurrent publish/draft-save winning a race
 * against this one, discovered by an individual `adminPublish`/
 * `adminPublishHomeLayout` call's own CAS check *after* the pre-check
 * below already passed) aborts and rolls back the whole transaction -
 * including any earlier item in this same call that had already
 * "succeeded" inside it - before returning the same `conflict` shape the
 * up-front fingerprint mismatch already used.
 */
export type HomePublishConfirmResult =
  | Readonly<{ ok: true; published: readonly HomePublishPlanItemRef[] }>
  | Readonly<{
      ok: false;
      conflict: true;
      freshMatrix: HomePreflightMatrix;
      freshExpectedState: HomePreflightExpectedState;
      freshLayoutHasPendingDraft: boolean;
    }>;

/** `HOME_SECTION_KEYS` order, then `HOME_PREFLIGHT_LOCALE_ORDER` order - the
 * fixed execution order every confirm attempt uses, regardless of the order
 * the client happened to submit `selection.sections` in, so a retried
 * confirm behaves identically. */
function orderedSectionPlan(
  selection: HomePreflightSelection,
): readonly Readonly<{ key: HomeSectionKey; locale: ContentLocale }>[] {
  const selected = new Set(selection.sections.map((entry) => `${entry.key}:${entry.locale}`));
  const ordered: Array<{ key: HomeSectionKey; locale: ContentLocale }> = [];
  for (const key of HOME_SECTION_KEYS) {
    for (const locale of HOME_PREFLIGHT_LOCALE_ORDER) {
      if (selected.has(`${key}:${locale}`)) ordered.push({ key, locale });
    }
  }
  return ordered;
}

/** Internal-only signal used to abort the surrounding `$transaction` when
 * an individual item's own CAS check reports a conflict mid-batch. Caught
 * by `confirmHomePublish`'s own `catch`, never leaked to its caller. */
class HomePublishAtomicAbort extends Error {}

/**
 * Re-validates a submitted publish plan against the current database state
 * and, only if it still checks out, executes the whole plan inside one
 * transaction. Never trusts the client beyond *which* items to attempt
 * (`input.selection`) and what it last saw (`input.expectedState`) - both
 * are re-derived and re-checked here before anything is written.
 */
export async function confirmHomePublish(
  client: PrismaClient,
  context: AdminContext,
  input: HomePublishConfirmInput,
): Promise<HomePublishConfirmResult> {
  assertAdminContext(context);

  const resolved = await resolveHomePreflightInputs(client, input.selection);
  const freshMatrix = runHomePublishPreflight(resolved, input.expectedState);

  if (freshMatrix.fingerprint !== input.expectedState.fingerprint || freshMatrix.blocked) {
    return {
      ok: false,
      conflict: true,
      freshMatrix,
      freshExpectedState: buildHomePreflightExpectedState(freshMatrix, resolved.candidateLayoutRevisionId),
      freshLayoutHasPendingDraft: resolved.layoutMeta.hasPendingDraft,
    };
  }

  const sectionPlan = orderedSectionPlan(input.selection);

  try {
    const published = await client.$transaction(async (tx) => {
      const publishedInTx: HomePublishPlanItemRef[] = [];

      if (input.selection.layoutSelected && resolved.layoutMeta.hasPendingDraft) {
        const layoutResult = await adminPublishHomeLayout(tx, context, {
          expectedVersion: resolved.layoutMeta.layoutVersion,
          expectedDraftRevisionId: resolved.layoutMeta.draftRevisionId as string,
        });
        if (!layoutResult.ok) throw new HomePublishAtomicAbort();
        publishedInTx.push({ kind: "layout" });
      }

      for (const { key, locale } of sectionPlan) {
        const meta = resolved.cellMeta[key][locale];
        const result = await adminPublish(
          tx,
          context,
          {
            translationId: meta.translationId,
            expectedVersion: meta.translationVersion,
            expectedDraftRevisionId: meta.candidateRevisionId as string,
          },
          undefined,
          {
            recorder: persistedOutboxRecorder,
            tags: [contentEntityTag(meta.entityId), contentAvailabilityTag(meta.entityId, locale), `home-section:${key}`],
          },
        );
        if (!result.ok) throw new HomePublishAtomicAbort();
        publishedInTx.push({ kind: "section", key, locale });
      }

      return publishedInTx;
    });

    return { ok: true, published };
  } catch (error) {
    if (!(error instanceof HomePublishAtomicAbort)) throw error;

    // The whole transaction rolled back - nothing published, database state
    // is exactly what it was before this call. Recompute a fresh matrix so
    // the caller sees precisely what changed (the race that caused the
    // abort) and can retry.
    const rechecked = await resolveHomePreflightInputs(client, input.selection);
    const reMatrix = runHomePublishPreflight(rechecked, input.expectedState);
    return {
      ok: false,
      conflict: true,
      freshMatrix: reMatrix,
      freshExpectedState: buildHomePreflightExpectedState(reMatrix, rechecked.candidateLayoutRevisionId),
      freshLayoutHasPendingDraft: rechecked.layoutMeta.hasPendingDraft,
    };
  }
}
