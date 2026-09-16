import { expect, test } from "../support/merged-fixtures";
import { createEntity, createTranslation } from "../../lib/content-model/model";
import { saveDraft, publish } from "../../lib/content-model/publishing";
import {
  SERVICE_FIXTURE_CONTENT_TYPE,
  SERVICE_FIXTURE_SCHEMA_VERSION,
} from "../../lib/content-model/payload-validation";
import { type AdminContext } from "../../lib/content-model/admin-context";
import { issueTestAdminContext } from "../../lib/content-model/admin-context-test-support";
import { adminSaveDraft, adminPublish } from "../../lib/content-model/admin-content-store";
import { getPublished } from "../../lib/content-model/public-content-reader";
import { ContentModelError } from "../../lib/content-model/errors";

// No file-level `test.use({ runIdentity: ... })` override, matching Story
// 0.2's precedent - each test keeps its own auto-derived, per-test-id run
// identity so concurrent Playwright workers never share one isolated schema.
test.setTimeout(120_000);

async function bootstrapAdminContext(
  client: Parameters<typeof createEntity>[0],
  overrides: Partial<{ id: string; email: string; name: string }> = {},
): Promise<AdminContext> {
  // A real AdminUser row so the audited path's AuditLog.userId foreign key
  // resolves. The actor's admin session itself is stubbed via
  // issueTestAdminContext (per Story 0.3's constraint: testing
  // requireAdmin()'s own cookie/session logic is Epic 1 Story 1.1's job) -
  // it still routes through admin-context.ts's real, unforgeable
  // provenance tracking, so it is a genuine AdminContext, not a shortcut.
  const user = await client.adminUser.create({
    data: {
      email: overrides.email ?? `story-0-3-${Math.random().toString(36).slice(2)}@example.com`,
      passwordHash: "unused-in-this-test",
      name: overrides.name ?? "Story 0.3 Actor",
    },
  });
  return issueTestAdminContext({
    id: overrides.id ?? user.id,
    email: user.email,
  });
}

/** Asserts `promise` rejects with a `ContentModelError` of the given
 * classification, and never with the raw underlying error - proving the
 * safe-surface normalization claim rather than merely "it throws
 * something". */
async function expectSafeRejection(
  promise: Promise<unknown>,
  classification: "invalidInput" | "internal",
) {
  let caught: unknown;
  try {
    await promise;
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(ContentModelError);
  if (!(caught instanceof ContentModelError)) throw new Error("unreachable");
  expect(caught.classification).toBe(classification);
}

test.describe("AC-0.3-01 - AdminContext production and forgery rejection", () => {
  test("CAP-1 a forged actor object is rejected before any mutation or audit write occurs", async ({
    testDatabase,
  }) => {
    const { client } = testDatabase;
    const entity = await createEntity(client, { contentType: SERVICE_FIXTURE_CONTENT_TYPE });
    const translation = await createTranslation(client, { entityId: entity.id, locale: "tr" });

    const forged = { actorId: "forged-actor", actorEmail: "forged@example.com" };

    await expectSafeRejection(
      adminSaveDraft(client, forged as unknown as AdminContext, {
        translationId: translation.id,
        expectedVersion: 0,
        schemaVersion: SERVICE_FIXTURE_SCHEMA_VERSION,
        payload: { title: "Danışmanlık", slug: "danismanlik", category: "Hizmet", order: 0 },
      }),
      "invalidInput",
    );

    expect(
      await client.contentTranslationRevision.count({ where: { translationId: translation.id } }),
    ).toBe(0);
    expect(await client.auditLog.count({ where: { entityId: translation.id } })).toBe(0);
    const unchanged = await client.contentTranslation.findUniqueOrThrow({
      where: { id: translation.id },
    });
    expect(unchanged.draftRevisionId).toBeNull();
    expect(unchanged.version).toBe(0);
  });

  test("CAP-1 an object merely descending from a real context (inherited brand, own attacker-chosen fields) is rejected", async ({
    testDatabase,
  }) => {
    const { client } = testDatabase;
    const context = await bootstrapAdminContext(client);
    const entity = await createEntity(client, { contentType: SERVICE_FIXTURE_CONTENT_TYPE });
    const translation = await createTranslation(client, { entityId: entity.id, locale: "tr" });

    // Object.create(context) inherits every property of a genuine,
    // WeakSet-registered context (including its brand symbol) through the
    // prototype chain. `context` itself is frozen, so a plain assignment
    // for `actorId`/`actorEmail` would throw (JS refuses to shadow a
    // frozen inherited data property via simple assignment in strict
    // mode) - defineProperty creates a genuinely new own property
    // instead, which is exactly how a real prototype-inheritance forgery
    // would be built. A property-based brand check (`BRAND in value`)
    // would accept this; identity (WeakSet membership) does not, because
    // this is a different object than the one `issue()` registered.
    const impostor: object = Object.create(context) as object;
    Object.defineProperty(impostor, "actorId", { value: "attacker", enumerable: true });
    Object.defineProperty(impostor, "actorEmail", {
      value: "attacker@example.com",
      enumerable: true,
    });

    await expectSafeRejection(
      adminSaveDraft(client, impostor as unknown as AdminContext, {
        translationId: translation.id,
        expectedVersion: 0,
        schemaVersion: SERVICE_FIXTURE_SCHEMA_VERSION,
        payload: { title: "Danışmanlık", slug: "danismanlik", category: "Hizmet", order: 0 },
      }),
      "invalidInput",
    );
    expect(await client.auditLog.count({ where: { entityId: translation.id } })).toBe(0);
  });
});

test.describe("AC-0.3-02 - audited draft save and publish", () => {
  test("CAP-2 adminSaveDraft/.adminPublish commit one AuditLog row per mutation in the same transaction, with a safe pointer summary", async ({
    testDatabase,
  }) => {
    const { client } = testDatabase;
    const context = await bootstrapAdminContext(client);
    const entity = await createEntity(client, { contentType: SERVICE_FIXTURE_CONTENT_TYPE });
    const translation = await createTranslation(client, { entityId: entity.id, locale: "tr" });

    const draft = await adminSaveDraft(client, context, {
      translationId: translation.id,
      expectedVersion: 0,
      schemaVersion: SERVICE_FIXTURE_SCHEMA_VERSION,
      payload: { title: "Danışmanlık", slug: "danismanlik", category: "Hizmet", order: 0 },
    });
    if (!draft.ok) throw new Error("adminSaveDraft unexpectedly conflicted");

    const draftAudits = await client.auditLog.findMany({ where: { entityId: translation.id } });
    expect(draftAudits).toHaveLength(1);
    expect(draftAudits[0].action).toBe("content.draft.save");
    expect(draftAudits[0].entity).toBe("ContentTranslation");
    expect(draftAudits[0].userId).toBe(context.actorId);
    expect(draftAudits[0].metadata).toEqual({
      locale: "tr",
      priorDraftRevisionId: null,
      nextDraftRevisionId: draft.revisionId,
      priorPublishedRevisionId: null,
      nextPublishedRevisionId: null,
      version: 1,
    });
    // Safe summary only - never the raw payload.
    expect(JSON.stringify(draftAudits[0].metadata)).not.toContain("Danışmanlık");

    const published = await adminPublish(client, context, {
      translationId: translation.id,
      expectedVersion: 1,
      expectedDraftRevisionId: draft.revisionId,
    });
    if (!published.ok) throw new Error("adminPublish unexpectedly conflicted");

    const allAudits = await client.auditLog.findMany({
      where: { entityId: translation.id },
      orderBy: { createdAt: "asc" },
    });
    expect(allAudits).toHaveLength(2);
    expect(allAudits[1].action).toBe("content.publish");
    expect(allAudits[1].metadata).toEqual({
      locale: "tr",
      priorDraftRevisionId: draft.revisionId,
      nextDraftRevisionId: draft.revisionId,
      priorPublishedRevisionId: null,
      nextPublishedRevisionId: draft.revisionId,
      version: 2,
    });
  });

  test("CAP-2 calling saveDraft/publish directly with no audit hook is unchanged from Story 0.2 (zero AuditLog rows)", async ({
    testDatabase,
  }) => {
    const { client } = testDatabase;
    const entity = await createEntity(client, { contentType: SERVICE_FIXTURE_CONTENT_TYPE });
    const translation = await createTranslation(client, { entityId: entity.id, locale: "tr" });

    const draft = await saveDraft(client, {
      translationId: translation.id,
      expectedVersion: 0,
      schemaVersion: SERVICE_FIXTURE_SCHEMA_VERSION,
      payload: { title: "Danışmanlık", slug: "danismanlik", category: "Hizmet", order: 0 },
      createdBy: "test:story-0-3-no-audit",
    });
    if (!draft.ok) throw new Error("saveDraft unexpectedly conflicted");

    const published = await publish(client, {
      translationId: translation.id,
      expectedVersion: 1,
      expectedDraftRevisionId: draft.revisionId,
    });
    if (!published.ok) throw new Error("publish unexpectedly conflicted");

    expect(await client.auditLog.count({ where: { entityId: translation.id } })).toBe(0);
  });

  test("CAP-2 a conflicted draft save/publish never invokes the audit hook (no audit row for a rejected mutation)", async ({
    testDatabase,
  }) => {
    const { client } = testDatabase;
    const context = await bootstrapAdminContext(client);
    const entity = await createEntity(client, { contentType: SERVICE_FIXTURE_CONTENT_TYPE });
    const translation = await createTranslation(client, { entityId: entity.id, locale: "tr" });

    const first = await adminSaveDraft(client, context, {
      translationId: translation.id,
      expectedVersion: 0,
      schemaVersion: SERVICE_FIXTURE_SCHEMA_VERSION,
      payload: { title: "V1", slug: "v1", category: "Hizmet", order: 0 },
    });
    if (!first.ok) throw new Error("first adminSaveDraft unexpectedly conflicted");

    // Stale expectedVersion (0, but the translation is already at 1) -
    // Story 0.2's own conflict path, reached before the audit hook.
    const staleDraft = await adminSaveDraft(client, context, {
      translationId: translation.id,
      expectedVersion: 0,
      schemaVersion: SERVICE_FIXTURE_SCHEMA_VERSION,
      payload: { title: "Stale", slug: "v1", category: "Hizmet", order: 0 },
    });
    expect(staleDraft.ok).toBe(false);

    const stalePublish = await adminPublish(client, context, {
      translationId: translation.id,
      expectedVersion: 0,
      expectedDraftRevisionId: "not-the-current-draft",
    });
    expect(stalePublish.ok).toBe(false);

    // Exactly one audit row - from the one successful save - never one for
    // either conflicted attempt.
    expect(await client.auditLog.count({ where: { entityId: translation.id } })).toBe(1);
  });
});

test.describe("AC-0.3-03 - audit-failure atomicity", () => {
  test("CAP-2 an audit write that violates a real constraint rolls back the whole draft-save transaction", async ({
    testDatabase,
  }) => {
    const { client } = testDatabase;
    const entity = await createEntity(client, { contentType: SERVICE_FIXTURE_CONTENT_TYPE });
    const translation = await createTranslation(client, { entityId: entity.id, locale: "tr" });

    // A real, provenance-tracked context whose actorId does not correspond
    // to any AdminUser row: AuditLog.userId's foreign key rejects the
    // audit write inside the same transaction as the mutation - a real
    // constraint violation, not a stubbed throw.
    const doomedContext = issueTestAdminContext({
      id: "does-not-exist-in-admin-user",
      email: "ghost@example.com",
    });

    await expectSafeRejection(
      adminSaveDraft(client, doomedContext, {
        translationId: translation.id,
        expectedVersion: 0,
        schemaVersion: SERVICE_FIXTURE_SCHEMA_VERSION,
        payload: { title: "Danışmanlık", slug: "danismanlik", category: "Hizmet", order: 0 },
      }),
      "internal",
    );

    expect(
      await client.contentTranslationRevision.count({ where: { translationId: translation.id } }),
    ).toBe(0);
    expect(await client.auditLog.count({ where: { entityId: translation.id } })).toBe(0);
    const unchanged = await client.contentTranslation.findUniqueOrThrow({
      where: { id: translation.id },
    });
    expect(unchanged.draftRevisionId).toBeNull();
    expect(unchanged.version).toBe(0);

    // PublicContentReader's projection is unaffected by the failed attempt.
    expect(await getPublished(client, { entityId: entity.id, locale: "tr" })).toBeNull();
  });

  test("CAP-2 the same audit-write failure rolls back a publish, leaving the prior published projection untouched", async ({
    testDatabase,
  }) => {
    const { client } = testDatabase;
    const context = await bootstrapAdminContext(client);
    const entity = await createEntity(client, { contentType: SERVICE_FIXTURE_CONTENT_TYPE });
    const translation = await createTranslation(client, { entityId: entity.id, locale: "tr" });

    const firstDraft = await adminSaveDraft(client, context, {
      translationId: translation.id,
      expectedVersion: 0,
      schemaVersion: SERVICE_FIXTURE_SCHEMA_VERSION,
      payload: { title: "V1", slug: "v1", category: "Hizmet", order: 0 },
    });
    if (!firstDraft.ok) throw new Error("firstDraft unexpectedly conflicted");
    const firstPublish = await adminPublish(client, context, {
      translationId: translation.id,
      expectedVersion: 1,
      expectedDraftRevisionId: firstDraft.revisionId,
    });
    if (!firstPublish.ok) throw new Error("firstPublish unexpectedly conflicted");

    const secondDraft = await adminSaveDraft(client, context, {
      translationId: translation.id,
      expectedVersion: 2,
      schemaVersion: SERVICE_FIXTURE_SCHEMA_VERSION,
      payload: { title: "V2", slug: "v1", category: "Hizmet", order: 1 },
    });
    if (!secondDraft.ok) throw new Error("secondDraft unexpectedly conflicted");

    const beforeFailedPublish = await getPublished(client, { entityId: entity.id, locale: "tr" });

    const doomedContext = issueTestAdminContext({
      id: "does-not-exist-in-admin-user",
      email: "ghost@example.com",
    });
    await expectSafeRejection(
      adminPublish(client, doomedContext, {
        translationId: translation.id,
        expectedVersion: 3,
        expectedDraftRevisionId: secondDraft.revisionId,
      }),
      "internal",
    );

    const unchanged = await client.contentTranslation.findUniqueOrThrow({
      where: { id: translation.id },
    });
    expect(unchanged.publishedRevisionId).toBe(firstDraft.revisionId);
    expect(unchanged.version).toBe(3);

    const afterFailedPublish = await getPublished(client, { entityId: entity.id, locale: "tr" });
    expect(afterFailedPublish).toEqual(beforeFailedPublish);
  });
});

test.describe("AC-0.3-04 - public read projection safety", () => {
  test("CAP-3 getPublished returns null for a translation with no publishedRevisionId", async ({
    testDatabase,
  }) => {
    const { client } = testDatabase;
    const entity = await createEntity(client, { contentType: SERVICE_FIXTURE_CONTENT_TYPE });
    const translation = await createTranslation(client, { entityId: entity.id, locale: "tr" });

    expect(await getPublished(client, { entityId: entity.id, locale: "tr" })).toBeNull();

    await saveDraft(client, {
      translationId: translation.id,
      expectedVersion: 0,
      schemaVersion: SERVICE_FIXTURE_SCHEMA_VERSION,
      payload: { title: "Danışmanlık", slug: "danismanlik", category: "Hizmet", order: 0 },
      createdBy: "test:story-0-3",
    });

    // A draft was saved but never published - still null.
    expect(await getPublished(client, { entityId: entity.id, locale: "tr" })).toBeNull();
  });

  test("CAP-3 getPublished returns exactly the safe field set for a published translation, no draft or admin field", async ({
    testDatabase,
  }) => {
    const { client } = testDatabase;
    const entity = await createEntity(client, { contentType: SERVICE_FIXTURE_CONTENT_TYPE });
    const translation = await createTranslation(client, { entityId: entity.id, locale: "tr" });
    const draft = await saveDraft(client, {
      translationId: translation.id,
      expectedVersion: 0,
      schemaVersion: SERVICE_FIXTURE_SCHEMA_VERSION,
      payload: { title: "Danışmanlık", slug: "danismanlik", category: "Hizmet", order: 0 },
      createdBy: "test:story-0-3",
    });
    if (!draft.ok) throw new Error("saveDraft unexpectedly conflicted");
    const published = await publish(client, {
      translationId: translation.id,
      expectedVersion: 1,
      expectedDraftRevisionId: draft.revisionId,
    });
    if (!published.ok) throw new Error("publish unexpectedly conflicted");

    const projection = await getPublished(client, { entityId: entity.id, locale: "tr" });
    if (!projection) throw new Error("expected a published projection");

    expect(Object.keys(projection).sort()).toEqual(
      ["entityId", "locale", "publishedRevisionId", "schemaVersion", "payload", "publishedAt", "version"].sort(),
    );
    expect(projection).not.toHaveProperty("draftRevisionId");
    expect(projection).not.toHaveProperty("createdBy");
    expect(projection.entityId).toBe(entity.id);
    expect(projection.locale).toBe("tr");
    expect(projection.publishedRevisionId).toBe(draft.revisionId);
    expect(projection.payload).toEqual({
      title: "Danışmanlık",
      slug: "danismanlik",
      category: "Hizmet",
      order: 0,
    });
  });

  test("CAP-3 getPublished for one translation never returns a sibling translation's revision, even sharing an entity", async ({
    testDatabase,
  }) => {
    const { client } = testDatabase;
    const entity = await createEntity(client, { contentType: SERVICE_FIXTURE_CONTENT_TYPE });
    const trTranslation = await createTranslation(client, { entityId: entity.id, locale: "tr" });
    const enTranslation = await createTranslation(client, { entityId: entity.id, locale: "en" });

    const trDraft = await saveDraft(client, {
      translationId: trTranslation.id,
      expectedVersion: 0,
      schemaVersion: SERVICE_FIXTURE_SCHEMA_VERSION,
      payload: { title: "Türkçe", slug: "tr-slug", category: "Hizmet", order: 0 },
      createdBy: "test:story-0-3",
    });
    if (!trDraft.ok) throw new Error("trDraft unexpectedly conflicted");
    const trPublish = await publish(client, {
      translationId: trTranslation.id,
      expectedVersion: 1,
      expectedDraftRevisionId: trDraft.revisionId,
    });
    if (!trPublish.ok) throw new Error("trPublish unexpectedly conflicted");

    // en has no published revision at all.
    const enProjection = await getPublished(client, { entityId: entity.id, locale: "en" });
    expect(enProjection).toBeNull();

    const trProjection = await getPublished(client, { entityId: entity.id, locale: "tr" });
    expect(trProjection?.publishedRevisionId).toBe(trDraft.revisionId);
    expect(trProjection?.payload).toEqual({
      title: "Türkçe",
      slug: "tr-slug",
      category: "Hizmet",
      order: 0,
    });
    void enTranslation;
  });
});

test.describe("AC-0.3-05 - draft mutation invisible to public reads", () => {
  test("CAP-3 saving a new draft on top of a published translation never changes the published payload/pointer it returns", async ({
    testDatabase,
  }) => {
    const { client } = testDatabase;
    const entity = await createEntity(client, { contentType: SERVICE_FIXTURE_CONTENT_TYPE });
    const translation = await createTranslation(client, { entityId: entity.id, locale: "tr" });
    const draft1 = await saveDraft(client, {
      translationId: translation.id,
      expectedVersion: 0,
      schemaVersion: SERVICE_FIXTURE_SCHEMA_VERSION,
      payload: { title: "V1", slug: "v1", category: "Hizmet", order: 0 },
      createdBy: "test:story-0-3",
    });
    if (!draft1.ok) throw new Error("draft1 unexpectedly conflicted");
    const publish1 = await publish(client, {
      translationId: translation.id,
      expectedVersion: 1,
      expectedDraftRevisionId: draft1.revisionId,
    });
    if (!publish1.ok) throw new Error("publish1 unexpectedly conflicted");

    const beforeSecondDraft = await getPublished(client, { entityId: entity.id, locale: "tr" });

    const draft2 = await saveDraft(client, {
      translationId: translation.id,
      expectedVersion: 2,
      schemaVersion: SERVICE_FIXTURE_SCHEMA_VERSION,
      payload: { title: "V2 - not yet published", slug: "v1", category: "Hizmet", order: 5 },
      createdBy: "test:story-0-3",
    });
    if (!draft2.ok) throw new Error("draft2 unexpectedly conflicted");
    expect(draft2.revisionId).not.toBe(draft1.revisionId);

    const afterSecondDraft = await getPublished(client, { entityId: entity.id, locale: "tr" });
    if (!afterSecondDraft) throw new Error("expected a published projection to still exist");
    // The load-bearing invariant: the published pointer, its payload, and
    // its own revision/schema/publishedAt never move because of an
    // unrelated draft save.
    expect(afterSecondDraft.publishedRevisionId).toBe(beforeSecondDraft?.publishedRevisionId);
    expect(afterSecondDraft.schemaVersion).toBe(beforeSecondDraft?.schemaVersion);
    expect(afterSecondDraft.publishedAt).toEqual(beforeSecondDraft?.publishedAt);
    expect(afterSecondDraft.payload).toEqual({
      title: "V1",
      slug: "v1",
      category: "Hizmet",
      order: 0,
    });
    // `version` is the translation row's shared optimistic-concurrency
    // counter, not a per-published-revision version - it legitimately
    // advances on the draft save that just happened, even though nothing
    // published changed. Documented here, not treated as a regression.
    expect(afterSecondDraft.version).toBe((beforeSecondDraft?.version ?? 0) + 1);
  });
});
