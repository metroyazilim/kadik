import { expect, test } from "../support/merged-fixtures";
import type { PrismaClient } from "@prisma/client";
import {
  ensureHomeSectionRegistry,
  HOME_SECTION_KEYS,
  homeSectionContentType,
} from "../../lib/content-model/home-section-registry";
import {
  getHomeLayoutWorkingState,
  publishHomeLayout,
  reorderHomeSections,
  saveHomeLayoutDraft,
  setHomeSectionVisibility,
} from "../../lib/content-model/home-layout";
import {
  adminGetHomeLayoutView,
  adminPublishHomeLayout,
  adminReorderHomeSections,
  adminSetHomeSectionVisibility,
} from "../../lib/content-model/home-admin-store";
import { getHomeLayoutAdminView } from "../../lib/content-model/home-registry-view";
import { issueTestAdminContext } from "../../lib/content-model/admin-context-test-support";
import type { AdminContext } from "../../lib/content-model/admin-context";
import { ContentModelError } from "../../lib/content-model/errors";

// No file-level `test.use({ runIdentity: ... })` override, matching Story
// 0.2/0.3's precedent - each test keeps its own auto-derived, per-test-id
// run identity so concurrent Playwright workers never share one schema.
test.setTimeout(120_000);

async function bootstrapAdminContext(
  client: PrismaClient,
  overrides: Partial<{ id: string; email: string; name: string }> = {},
): Promise<AdminContext> {
  const user = await client.adminUser.create({
    data: {
      email: overrides.email ?? `home-admin-${Math.random().toString(36).slice(2)}@example.com`,
      passwordHash: "unused-in-tests",
      name: overrides.name ?? "Home Test Admin",
    },
  });
  return issueTestAdminContext({ id: user.id, email: user.email });
}

test.describe("AC-2.1-01 - registry bootstrap", () => {
  test("CAP-1 creates exactly eleven entities, sections, and 22 translations, idempotently", async ({
    testDatabase,
  }) => {
    const { client } = testDatabase;
    await ensureHomeSectionRegistry(client);
    await ensureHomeSectionRegistry(client); // second call must not duplicate anything

    const sections = await client.homeSection.findMany({ orderBy: { key: "asc" } });
    expect(sections).toHaveLength(11);
    expect(new Set(sections.map((s) => s.key)).size).toBe(11);

    const entities = await client.contentEntity.findMany({
      where: { contentType: { startsWith: "home-section:" } },
    });
    expect(entities).toHaveLength(11);
    for (const key of HOME_SECTION_KEYS) {
      expect(entities.some((e) => e.contentType === homeSectionContentType(key))).toBe(true);
    }

    const translationCount = await client.contentTranslation.count({
      where: { entity: { contentType: { startsWith: "home-section:" } } },
    });
    expect(translationCount).toBe(22);

    const layouts = await client.homeLayout.findMany();
    expect(layouts).toHaveLength(1);
    expect(layouts[0]!.draftRevisionId).toBe(layouts[0]!.publishedRevisionId);
    expect(layouts[0]!.version).toBe(1);

    const view = await getHomeLayoutAdminView(client);
    expect(view.sections.map((s) => s.key)).toEqual([...HOME_SECTION_KEYS]);
    expect(view.isDraftPending).toBe(false);
    for (const section of view.sections) {
      expect(section.enabled).toBe(true);
      expect(section.localeStatus).toEqual({ tr: "missing", en: "missing" });
    }
  });
});

test.describe("AC-2.1-02/03/05/06 - reorder, visibility, draft isolation", () => {
  test("CAP-2/CAP-3 reorder inserts a new draft revision without moving the published pointer", async ({
    testDatabase,
  }) => {
    const { client } = testDatabase;
    await ensureHomeSectionRegistry(client);
    const context = await bootstrapAdminContext(client);

    const before = await getHomeLayoutWorkingState(client);
    const reversed = [...HOME_SECTION_KEYS].reverse();

    const result = await adminReorderHomeSections(client, context, {
      expectedVersion: before.layout!.version,
      orderedKeys: reversed,
    });
    if (!result.ok) throw new Error("reorder unexpectedly conflicted");
    expect(result.layout.draftRevisionId).not.toBe(before.layout!.publishedRevisionId);
    expect(result.layout.publishedRevisionId).toBe(before.layout!.publishedRevisionId); // AC-2.1-05
    expect(result.layout.version).toBe(before.layout!.version + 1);

    const view = await getHomeLayoutAdminView(client);
    expect(view.sections.map((s) => s.key)).toEqual(reversed); // admin sees the draft order
    expect(view.isDraftPending).toBe(true); // AC-2.1-06

    // Public would still see the original published order/visibility.
    const publishedLayout = await client.homeLayout.findUniqueOrThrow({
      where: { singleton: true },
      include: { publishedRevision: true },
    });
    expect(publishedLayout.publishedRevision!.payload).toEqual(before.payload);

    const auditRow = await client.auditLog.findFirst({
      where: { action: "home.layout.draft.save", entityId: result.layout.id },
      orderBy: { createdAt: "desc" },
    });
    expect(auditRow).not.toBeNull();
    expect(auditRow!.userId).toBe(context.actorId);
  });

  test("CAP-3 visibility toggle changes only the requested section", async ({ testDatabase }) => {
    const { client } = testDatabase;
    await ensureHomeSectionRegistry(client);
    const context = await bootstrapAdminContext(client);

    const before = await getHomeLayoutWorkingState(client);
    const result = await adminSetHomeSectionVisibility(client, context, {
      expectedVersion: before.layout!.version,
      key: "marquee",
      enabled: false,
    });
    if (!result.ok) throw new Error("visibility toggle unexpectedly conflicted");

    const view = await getHomeLayoutAdminView(client);
    expect(view.sections.map((s) => s.key)).toEqual(before.payload.map((e) => e.key)); // order untouched
    for (const section of view.sections) {
      expect(section.enabled).toBe(section.key === "marquee" ? false : true);
    }
  });

  test("AC-2.1-06 changedSincePublished is true only for sections that differ from the published payload", async ({
    testDatabase,
  }) => {
    const { client } = testDatabase;
    await ensureHomeSectionRegistry(client);
    const context = await bootstrapAdminContext(client);
    const before = await getHomeLayoutWorkingState(client);

    await adminSetHomeSectionVisibility(client, context, {
      expectedVersion: before.layout!.version,
      key: "blog",
      enabled: false,
    });

    const view = await getHomeLayoutAdminView(client);
    for (const section of view.sections) {
      expect(section.changedSincePublished).toBe(section.key === "blog");
    }
  });
});

test.describe("Concurrency safety (mirrors AC-0.2-03)", () => {
  test("a stale expectedVersion returns a safe conflict without mutating state", async ({ testDatabase }) => {
    const { client } = testDatabase;
    await ensureHomeSectionRegistry(client);
    const before = await client.homeLayout.findUniqueOrThrow({ where: { singleton: true } });

    const result = await saveHomeLayoutDraft(client, {
      expectedVersion: before.version + 99,
      schemaVersion: 1,
      payload: (await getHomeLayoutWorkingState(client)).payload,
      createdBy: "test:story-2-1",
      changeKind: "reorder",
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.conflict).toBe(true);

    const after = await client.homeLayout.findUniqueOrThrow({ where: { singleton: true } });
    expect(after.version).toBe(before.version);
    expect(after.draftRevisionId).toBe(before.draftRevisionId);
    expect(after.publishedRevisionId).toBe(before.publishedRevisionId);
  });

  test("a stale publish (expectedVersion or expectedDraftRevisionId) returns a safe conflict without mutation", async ({
    testDatabase,
  }) => {
    const { client } = testDatabase;
    await ensureHomeSectionRegistry(client);
    const before = await client.homeLayout.findUniqueOrThrow({ where: { singleton: true } });

    const result = await publishHomeLayout(client, {
      expectedVersion: before.version,
      expectedDraftRevisionId: "not-the-real-draft-id",
      publishedBy: "test:story-2-1",
    });
    expect(result.ok).toBe(false);

    const after = await client.homeLayout.findUniqueOrThrow({ where: { singleton: true } });
    expect(after.version).toBe(before.version);
    expect(after.publishedRevisionId).toBe(before.publishedRevisionId);
  });
});

test.describe("AC-2.1-05 - publish moves the pointer atomically", () => {
  test("publish repoints publishedRevisionId to the current draft and writes an outbox event", async ({
    testDatabase,
  }) => {
    const { client } = testDatabase;
    await ensureHomeSectionRegistry(client);
    const context = await bootstrapAdminContext(client);

    const before = await getHomeLayoutWorkingState(client);
    const reordered = await adminReorderHomeSections(client, context, {
      expectedVersion: before.layout!.version,
      orderedKeys: [...HOME_SECTION_KEYS].reverse(),
    });
    if (!reordered.ok) throw new Error("reorder unexpectedly conflicted");

    const published = await adminPublishHomeLayout(client, context, {
      expectedVersion: reordered.layout.version,
      expectedDraftRevisionId: reordered.revisionId,
    });
    if (!published.ok) throw new Error("publish unexpectedly conflicted");
    expect(published.layout.publishedRevisionId).toBe(reordered.revisionId);
    expect(published.layout.draftRevisionId).toBe(published.layout.publishedRevisionId);

    const view = await getHomeLayoutAdminView(client);
    expect(view.isDraftPending).toBe(false);
    for (const section of view.sections) expect(section.changedSincePublished).toBe(false);

    const outboxEvent = await client.invalidationOutboxEvent.findFirst({
      where: { sourceEntityId: published.layout.id },
      orderBy: { createdAt: "desc" },
    });
    expect(outboxEvent).not.toBeNull();
    expect(outboxEvent!.tags).toEqual(["home:layout"]);
    expect(outboxEvent!.sourceTranslationId).toBeNull();
    expect(outboxEvent!.locale).toBeNull();

    const publishAudit = await client.auditLog.findFirst({
      where: { action: "home.layout.publish", entityId: published.layout.id },
    });
    expect(publishAudit).not.toBeNull();
  });
});

test.describe("AC-0.3-01 equivalent - actor provenance for Home mutations", () => {
  test("adminReorderHomeSections/adminSetHomeSectionVisibility/adminPublishHomeLayout reject a forged context", async ({
    testDatabase,
  }) => {
    const { client } = testDatabase;
    await ensureHomeSectionRegistry(client);
    const real = await bootstrapAdminContext(client);
    const forged = Object.create(real) as AdminContext; // inherits the brand via prototype chain, not identity

    await expect(
      adminReorderHomeSections(client, forged, { expectedVersion: 1, orderedKeys: HOME_SECTION_KEYS }),
    ).rejects.toBeInstanceOf(ContentModelError);
    await expect(
      adminSetHomeSectionVisibility(client, forged, { expectedVersion: 1, key: "hero", enabled: false }),
    ).rejects.toBeInstanceOf(ContentModelError);
    await expect(
      adminPublishHomeLayout(client, forged, { expectedVersion: 1, expectedDraftRevisionId: "x" }),
    ).rejects.toBeInstanceOf(ContentModelError);
    await expect(adminGetHomeLayoutView(client, forged)).rejects.toBeInstanceOf(ContentModelError);
  });
});
