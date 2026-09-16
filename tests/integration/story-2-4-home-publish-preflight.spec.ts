import { expect, test } from "../support/merged-fixtures";
import { PrismaClient } from "@prisma/client";
import { ensureHomeSectionRegistry } from "../../lib/content-model/home-section-registry";
import { adminGetHomeSectionEditorView } from "../../lib/content-model/home-section-editor-store";
import { adminSaveDraft } from "../../lib/content-model/admin-content-store";
import { adminReorderHomeSections } from "../../lib/content-model/home-admin-store";
import { getHomeLayoutAdminView } from "../../lib/content-model/home-registry-view";
import { defaultHomeSectionPayload, HOME_SECTION_SCHEMA_VERSION } from "../../lib/content-model/home-section-schemas";
import {
  buildDefaultHomePublishSelection,
  resolveHomePreflightInputs,
} from "../../lib/content-model/home-preflight-resolver";
import {
  runHomePublishPreflight,
  buildHomePreflightExpectedState,
} from "../../lib/content-model/home-preflight";
import { confirmHomePublish } from "../../lib/content-model/home-publish-confirm";
import type { AdminContext } from "../../lib/content-model/admin-context";
import { issueTestAdminContext } from "../../lib/content-model/admin-context-test-support";

test.setTimeout(120_000);

async function bootstrapAdminContext(
  client: PrismaClient,
  overrides: Partial<{ id: string; email: string; name: string }> = {},
): Promise<AdminContext> {
  const user = await client.adminUser.create({
    data: {
      email: overrides.email ?? `home-publish-admin-${Math.random().toString(36).slice(2)}@example.com`,
      passwordHash: "unused-in-tests",
      name: overrides.name ?? "Home Publish Test Admin",
    },
  });
  return issueTestAdminContext({ id: user.id, email: user.email });
}

async function saveHeroDraft(client: PrismaClient, context: AdminContext, locale: "tr" | "en" = "tr") {
  const view = await adminGetHomeSectionEditorView(client, context, "hero", locale);
  const payload = defaultHomeSectionPayload("hero");
  const block = payload.blocks[0];
  if (block.type === "text") {
    block.html = `<p>Draft title ${Math.random().toString(36).slice(2, 8)}</p>`;
  }
  await adminSaveDraft(client, context, {
    translationId: view.translationId,
    expectedVersion: view.version,
    schemaVersion: HOME_SECTION_SCHEMA_VERSION,
    payload,
  });
  return adminGetHomeSectionEditorView(client, context, "hero", locale);
}

test.describe("Story 2.4 Integration - resolver reflects real database state (AC-2.4-01)", () => {
  test("buildDefaultHomePublishSelection is empty when nothing has a pending draft, and picks up drafts once one is saved", async ({
    testDatabase,
  }) => {
    const { client } = testDatabase;
    await ensureHomeSectionRegistry(client);
    const context = await bootstrapAdminContext(client);

    const emptySelection = await buildDefaultHomePublishSelection(client);
    expect(emptySelection.layoutSelected).toBe(false);
    expect(emptySelection.sections).toEqual([]);

    await saveHeroDraft(client, context, "tr");
    const layoutView = await getHomeLayoutAdminView(client);
    await adminReorderHomeSections(client, context, {
      expectedVersion: layoutView.version,
      orderedKeys: [...layoutView.sections].reverse().map((s) => s.key),
    });

    const selection = await buildDefaultHomePublishSelection(client);
    expect(selection.layoutSelected).toBe(true);
    expect(selection.sections).toContainEqual({ key: "hero", locale: "tr" });
  });

  test("resolveHomePreflightInputs marks a selected draft as candidateIsDraft with the draft's own payload", async ({
    testDatabase,
  }) => {
    const { client } = testDatabase;
    await ensureHomeSectionRegistry(client);
    const context = await bootstrapAdminContext(client);
    const view = await saveHeroDraft(client, context, "tr");

    const resolved = await resolveHomePreflightInputs(client, {
      layoutSelected: false,
      sections: [{ key: "hero", locale: "tr" }],
    });

    const cell = resolved.cellMeta.hero.tr;
    expect(cell.candidateIsDraft).toBe(true);
    const translationRow = await client.contentTranslation.findUniqueOrThrow({
      where: { id: view.translationId },
    });
    expect(cell.candidateRevisionId).toBe(translationRow.draftRevisionId);
    expect(cell.candidateRevisionId).not.toBeNull();
    expect(resolved.candidateProjectionsByLocale.tr.hero?.fallbackApplied).toBe(false);

    // Unselected locale for the same key falls back to its (nonexistent)
    // published pointer, not the draft - never publishes what wasn't asked for.
    const unselectedCell = resolved.cellMeta.hero.en;
    expect(unselectedCell.candidateIsDraft).toBe(false);
    expect(unselectedCell.candidateRevisionId).toBeNull();
  });
});

test.describe("Story 2.4 Integration - confirmHomePublish execution (AC-2.4-03, AC-2.4-04)", () => {
  test("a clean confirm publishes only the selected item and leaves every unselected draft untouched", async ({
    testDatabase,
  }) => {
    const { client } = testDatabase;
    await ensureHomeSectionRegistry(client);
    const context = await bootstrapAdminContext(client);

    await saveHeroDraft(client, context, "tr");
    await saveHeroDraft(client, context, "en"); // deliberately left unselected below

    const selection = { layoutSelected: false, sections: [{ key: "hero" as const, locale: "tr" as const }] };
    const resolved = await resolveHomePreflightInputs(client, selection);
    const matrix = runHomePublishPreflight(resolved);
    const expectedState = buildHomePreflightExpectedState(matrix, resolved.candidateLayoutRevisionId);

    const result = await confirmHomePublish(client, context, { selection, expectedState });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.published).toEqual([{ kind: "section", key: "hero", locale: "tr" }]);

    const trView = await adminGetHomeSectionEditorView(client, context, "hero", "tr");
    expect(trView.status).toBe("published");

    const enView = await adminGetHomeSectionEditorView(client, context, "hero", "en");
    expect(enView.status).toBe("draft"); // untouched - was never selected
  });

  test("publishing the layout and a section together publishes both, in order", async ({ testDatabase }) => {
    const { client } = testDatabase;
    await ensureHomeSectionRegistry(client);
    const context = await bootstrapAdminContext(client);

    await saveHeroDraft(client, context, "tr");
    const layoutView = await getHomeLayoutAdminView(client);
    await adminReorderHomeSections(client, context, {
      expectedVersion: layoutView.version,
      orderedKeys: [...layoutView.sections].reverse().map((s) => s.key),
    });

    const selection = { layoutSelected: true, sections: [{ key: "hero" as const, locale: "tr" as const }] };
    const resolved = await resolveHomePreflightInputs(client, selection);
    const matrix = runHomePublishPreflight(resolved);
    const expectedState = buildHomePreflightExpectedState(matrix, resolved.candidateLayoutRevisionId);

    const result = await confirmHomePublish(client, context, { selection, expectedState });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.published[0]).toEqual({ kind: "layout" });
    expect(result.published).toContainEqual({ kind: "section", key: "hero", locale: "tr" });

    const layoutAfter = await getHomeLayoutAdminView(client);
    expect(layoutAfter.isDraftPending).toBe(false);
  });

  test("a fingerprint that no longer matches the current database state is rejected with zero mutation", async ({
    testDatabase,
  }) => {
    const { client } = testDatabase;
    await ensureHomeSectionRegistry(client);
    const context = await bootstrapAdminContext(client);

    await saveHeroDraft(client, context, "tr");
    const selection = { layoutSelected: false, sections: [{ key: "hero" as const, locale: "tr" as const }] };
    const resolved = await resolveHomePreflightInputs(client, selection);
    const matrix = runHomePublishPreflight(resolved);
    const staleExpectedState = buildHomePreflightExpectedState(matrix, resolved.candidateLayoutRevisionId);

    // Someone else resaves a new draft after the admin's view was rendered.
    await saveHeroDraft(client, context, "tr");

    const result = await confirmHomePublish(client, context, { selection, expectedState: staleExpectedState });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect("conflict" in result && result.conflict).toBe(true);

    const viewAfter = await adminGetHomeSectionEditorView(client, context, "hero", "tr");
    expect(viewAfter.status).toBe("draft"); // still unpublished - zero mutation happened
  });

  test("a selected cell with an invalid draft payload blocks confirm even when the client submits it anyway", async ({
    testDatabase,
  }) => {
    const { client } = testDatabase;
    await ensureHomeSectionRegistry(client);
    const context = await bootstrapAdminContext(client);
    const view = await adminGetHomeSectionEditorView(client, context, "hero", "tr");

    // Bypass validateHomeSectionPayload to persist a structurally invalid
    // draft directly, simulating a payload that fails re-validation at
    // publish time (e.g. a schema tightened after the draft was saved).
    await client.contentTranslationRevision.create({
      data: {
        translationId: view.translationId,
        schemaVersion: HOME_SECTION_SCHEMA_VERSION,
        payload: { blocks: "not-an-array" },
        createdBy: context.actorId,
      },
    });
    const revision = await client.contentTranslationRevision.findFirstOrThrow({
      where: { translationId: view.translationId },
      orderBy: { createdAt: "desc" },
    });
    await client.contentTranslation.update({
      where: { id: view.translationId },
      data: { draftRevisionId: revision.id, version: { increment: 1 } },
    });

    const selection = { layoutSelected: false, sections: [{ key: "hero" as const, locale: "tr" as const }] };
    const resolved = await resolveHomePreflightInputs(client, selection);
    const matrix = runHomePublishPreflight(resolved);
    expect(matrix.cells.hero.tr.outcome).toBe("INVALID");
    expect(matrix.blocked).toBe(true);
    const expectedState = buildHomePreflightExpectedState(matrix, resolved.candidateLayoutRevisionId);

    const result = await confirmHomePublish(client, context, { selection, expectedState });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect("conflict" in result && result.conflict).toBe(true);

    const viewAfter = await adminGetHomeSectionEditorView(client, context, "hero", "tr");
    expect(viewAfter.status).toBe("draft"); // blocked - never reached adminPublish
  });
});

test.describe("Story 2.6 Integration - atomic publish and invalidation outbox", () => {
  test("a mid-batch CAS failure rolls back every earlier item in the same atomic batch", async ({ testDatabase }) => {
    const { client, databaseUrl } = testDatabase;
    await ensureHomeSectionRegistry(client);
    const context = await bootstrapAdminContext(client);

    await saveHeroDraft(client, context, "tr");
    const viewAboutBefore = await adminGetHomeSectionEditorView(client, context, "about", "tr");
    const aboutPayload = defaultHomeSectionPayload("about");
    await adminSaveDraft(client, context, {
      translationId: viewAboutBefore.translationId,
      expectedVersion: viewAboutBefore.version,
      schemaVersion: HOME_SECTION_SCHEMA_VERSION,
      payload: aboutPayload,
    });

    const selection = {
      layoutSelected: false,
      sections: [
        { key: "hero" as const, locale: "tr" as const },
        { key: "about" as const, locale: "tr" as const },
      ],
    };
    const resolved = await resolveHomePreflightInputs(client, selection);
    const matrix = runHomePublishPreflight(resolved);
    const expectedState = buildHomePreflightExpectedState(matrix, resolved.candidateLayoutRevisionId);
    const aboutTranslationId = resolved.cellMeta.about.tr.translationId;

    // Real concurrency, not a stubbed race: kick off confirmHomePublish
    // (its own up-front resolve/preflight involves many sequential DB
    // round trips before its transaction even opens), then - on an
    // independent connection - bump `about`'s version without touching its
    // draftRevisionId. The fingerprint (revision-id keyed) already matched
    // before this write lands, so it can only be caught by `about`'s own
    // version-based CAS check once the transaction actually reaches it -
    // by which point `hero` (ordered first) has already "succeeded" inside
    // that same still-open transaction.
    const confirmPromise = confirmHomePublish(client, context, { selection, expectedState });
    const independent = new PrismaClient({ datasourceUrl: databaseUrl });
    try {
      await independent.contentTranslation.update({
        where: { id: aboutTranslationId },
        data: { version: { increment: 1 } },
      });
    } finally {
      await independent.$disconnect();
    }
    const result = await confirmPromise;

    expect(result.ok).toBe(false);
    const heroAfter = await adminGetHomeSectionEditorView(client, context, "hero", "tr");
    expect(heroAfter.status).toBe("draft"); // rolled back, not left published
    const aboutAfter = await adminGetHomeSectionEditorView(client, context, "about", "tr");
    expect(aboutAfter.status).toBe("draft");
  });

  test("a successful section publish commits exactly one InvalidationOutboxEvent carrying its cache tags", async ({
    testDatabase,
  }) => {
    const { client } = testDatabase;
    await ensureHomeSectionRegistry(client);
    const context = await bootstrapAdminContext(client);

    const view = await saveHeroDraft(client, context, "tr");
    const selection = { layoutSelected: false, sections: [{ key: "hero" as const, locale: "tr" as const }] };
    const resolved = await resolveHomePreflightInputs(client, selection);
    const matrix = runHomePublishPreflight(resolved);
    const expectedState = buildHomePreflightExpectedState(matrix, resolved.candidateLayoutRevisionId);

    const before = await client.invalidationOutboxEvent.count({ where: { sourceEntityId: view.entityId } });
    const result = await confirmHomePublish(client, context, { selection, expectedState });
    expect(result.ok).toBe(true);

    const events = await client.invalidationOutboxEvent.findMany({ where: { sourceEntityId: view.entityId } });
    expect(events.length).toBe(before + 1);
    expect(events[events.length - 1].tags).toEqual(
      expect.arrayContaining(["home-section:hero"]),
    );
  });
});
