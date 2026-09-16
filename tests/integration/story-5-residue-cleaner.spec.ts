import { expect, test } from "../support/merged-fixtures";
import { computeResidueReport, applyResidueCleanup } from "../../scripts/clean-e2e-residue";
import { ensureSiteSettingsEntity } from "../../lib/content-model/site-settings-registry";
import { saveDraft, publish } from "../../lib/content-model/publishing";
import { SITE_SETTINGS_SCHEMA_VERSION } from "../../lib/content-model/site-settings-schema";
import { SERVICE_SCHEMA_VERSION, POST_SCHEMA_VERSION } from "../../lib/content-model/payload-validation";

test.setTimeout(120_000);

test.describe("Spec 5 - clean-e2e-residue selectivity (AC-5.12)", () => {
  test("removes exactly the marker-tagged rows and leaves every non-marker row untouched", async ({ testDatabase }) => {
    const { client } = testDatabase;

    // Real, hand-authored content: an AdminUser with a genuine email, a
    // ContentEntity with the ordinary "authored" provenance, and a real
    // visitor Message - none of this may ever be selected for deletion.
    const realAdmin = await client.adminUser.create({
      data: { email: "gercek.admin@metroyazilim.com", passwordHash: "x", name: "Gerçek Admin" },
    });
    const realEntity = await client.contentEntity.create({ data: { contentType: "service", provenance: "authored" } });
    const realMessage = await client.message.create({
      data: {
        locale: "tr",
        name: "Gerçek Ziyaretçi",
        email: "ziyaretci@gmail.com",
        message: "Gerçek bir mesaj.",
        submissionHash: `real-${crypto.randomUUID()}`,
      },
    });

    // E2E-marker rows: exactly what `e2e-data-fixture.ts` and the migrated
    // e2e test files produce.
    const e2eAdmin = await client.adminUser.create({
      data: { email: `e2e-${crypto.randomUUID()}@example.test`, passwordHash: "x", name: "E2E Actor" },
    });
    const e2eEntity = await client.contentEntity.create({ data: { contentType: "service", provenance: "e2e-test" } });
    const e2eMessage = await client.message.create({
      data: {
        locale: "tr",
        name: "E2E Ziyaretçi",
        email: `e2e-${crypto.randomUUID()}@example.test`,
        message: "E2E test mesajı.",
        submissionHash: `e2e-${crypto.randomUUID()}`,
      },
    });

    // Site-settings singleton published once by a real admin, then drafted
    // (never published) by an E2E actor - the cleaner must reset this
    // translation (the draft was written by an E2E actor) while never
    // touching the real admin/entity/message rows above.
    const { entityId: siteSettingsEntityId } = await ensureSiteSettingsEntity(client);
    const translation = await client.contentTranslation.findUniqueOrThrow({
      where: { entityId_locale: { entityId: siteSettingsEntityId, locale: "tr" } },
    });
    const realPayload = {
      brand: { name: "Gerçek Marka", logoAssetId: null },
      contact: { email: null, phone: null, address: null },
      cta: { label: null, url: null },
      navigation: [],
      footer: { summary: "Gerçek özet.", columns: [] },
      mission: "Gerçek misyon.",
      vision: "Gerçek vizyon.",
      termsBody: "<p>Gerçek şartlar.</p>",
      privacyBody: "<p>Gerçek gizlilik.</p>",
    };
    const realDraft = await saveDraft(client, {
      translationId: translation.id,
      expectedVersion: translation.version,
      schemaVersion: SITE_SETTINGS_SCHEMA_VERSION,
      payload: realPayload,
      createdBy: realAdmin.id,
    });
    if (!realDraft.ok) throw new Error("unreachable");
    const realPublish = await publish(client, {
      translationId: translation.id,
      expectedVersion: realDraft.translation.version,
      expectedDraftRevisionId: realDraft.revisionId,
    });
    if (!realPublish.ok) throw new Error("unreachable");

    const e2eDraft = await saveDraft(client, {
      translationId: translation.id,
      expectedVersion: realPublish.translation.version,
      schemaVersion: SITE_SETTINGS_SCHEMA_VERSION,
      payload: { ...realPayload, brand: { name: "E2E marker marka", logoAssetId: null } },
      createdBy: e2eAdmin.id,
    });
    if (!e2eDraft.ok) throw new Error("unreachable");

    // Dry run: reports exactly the four marker-tagged targets, writes nothing.
    const report = await computeResidueReport(client);
    expect(report.counts).toEqual({
      contentEntities: 1,
      adminUsers: 1,
      messages: 1,
      singletonTranslationsReset: 1,
    });
    expect(report.contentEntityIds).toEqual([e2eEntity.id]);
    expect(report.adminUserIds).toEqual([e2eAdmin.id]);
    expect(report.messageIds).toEqual([e2eMessage.id]);
    expect(report.singletonTranslations).toHaveLength(1);
    expect(report.singletonTranslations[0]!.translationId).toBe(translation.id);
    expect(report.singletonTranslations[0]!.resetDraftRevisionId).toBe(e2eDraft.revisionId);
    expect(report.singletonTranslations[0]!.resetPublishedRevisionId).toBeNull();

    expect(await client.contentEntity.count()).toBe(3); // realEntity + e2eEntity + the site-settings singleton entity
    expect(await client.adminUser.count()).toBe(2);
    expect(await client.message.count()).toBe(2);

    await applyResidueCleanup(client, report);

    // Real rows: all untouched, including the real published site-settings
    // pointer and revision - the reset only ever clears a pointer whose
    // *own* revision was E2E-authored; the published revision here was
    // authored by `realAdmin`, so it is preserved verbatim even though an
    // E2E actor later drafted on top of it.
    expect(await client.adminUser.findUnique({ where: { id: realAdmin.id } })).not.toBeNull();
    expect(await client.contentEntity.findUnique({ where: { id: realEntity.id } })).not.toBeNull();
    expect(await client.message.findUnique({ where: { id: realMessage.id } })).not.toBeNull();

    // E2E-marked rows: gone.
    expect(await client.adminUser.findUnique({ where: { id: e2eAdmin.id } })).toBeNull();
    expect(await client.contentEntity.findUnique({ where: { id: e2eEntity.id } })).toBeNull();
    expect(await client.message.findUnique({ where: { id: e2eMessage.id } })).toBeNull();

    // The singleton translation's real published pointer/revision survive
    // the reset intact; only its E2E-authored draft pointer was cleared,
    // and only the E2E draft's own revision was deleted.
    const resetTranslation = await client.contentTranslation.findUniqueOrThrow({
      where: { id: translation.id },
      include: { publishedRevision: true },
    });
    expect(resetTranslation.publishedRevisionId).not.toBeNull();
    expect(resetTranslation.publishedRevision?.createdBy).toBe(realAdmin.id);
    expect(resetTranslation.draftRevisionId).toBeNull();
    expect(await client.contentTranslationRevision.findUnique({ where: { id: e2eDraft.revisionId } })).toBeNull();
  });

  test("a dry run with no marker-tagged rows reports zero and deletes nothing", async ({ testDatabase }) => {
    const { client } = testDatabase;
    await client.adminUser.create({ data: { email: "sadece.gercek@metroyazilim.com", passwordHash: "x", name: "Sadece Gerçek" } });

    const report = await computeResidueReport(client);

    expect(report.counts).toEqual({ contentEntities: 0, adminUsers: 0, messages: 0, singletonTranslationsReset: 0 });
    expect(await client.adminUser.count()).toBe(1);
  });

  test("a real bootstrap admin at admin@example.com is never matched - only the e2e- prefixed convention is", async ({ testDatabase }) => {
    const { client } = testDatabase;
    // The exact shape `getAdminBootstrap()`/`prisma/seed.ts` produces in
    // this project's own local `.env` (`ADMIN_EMAIL=admin@example.com`) -
    // the regression this guards: an earlier version of this cleaner
    // matched any `@example.com` address regardless of prefix, which would
    // have flagged every genuinely seeded Home/site-settings/About
    // translation as E2E residue in exactly this environment.
    const bootstrapAdmin = await client.adminUser.create({
      data: { email: "admin@example.com", passwordHash: "x", name: "Metro Yazılım Admin" },
    });
    const e2eStyleAdmin = await client.adminUser.create({
      data: { email: `e2e-${crypto.randomUUID()}@example.com`, passwordHash: "x", name: "E2E Actor" },
    });

    const report = await computeResidueReport(client);

    expect(report.adminUserIds).toEqual([e2eStyleAdmin.id]);
    expect(report.adminUserIds).not.toContain(bootstrapAdmin.id);
  });

  test("an ordinary entity where every revision was authored by an E2E actor is removed even without the e2e-test provenance marker; a mixed-author entity is preserved", async ({ testDatabase }) => {
    const { client } = testDatabase;
    const realAdmin = await client.adminUser.create({
      data: { email: "gercek.admin2@metroyazilim.com", passwordHash: "x", name: "Gerçek Admin" },
    });
    const e2eAdmin = await client.adminUser.create({
      data: { email: `e2e-${crypto.randomUUID()}@example.test`, passwordHash: "x", name: "E2E Actor" },
    });

    // An E2E test that drove the real admin UI: a genuinely "authored"
    // entity (never "e2e-test") whose only translation's only revision was
    // created by the E2E actor - exactly what rule 1 alone cannot see.
    const orphanedEntity = await client.contentEntity.create({ data: { contentType: "service", provenance: "authored" } });
    const orphanedTranslation = await client.contentTranslation.create({ data: { entityId: orphanedEntity.id, locale: "tr" } });
    const orphanedDraft = await saveDraft(client, {
      translationId: orphanedTranslation.id,
      expectedVersion: orphanedTranslation.version,
      schemaVersion: SERVICE_SCHEMA_VERSION,
      payload: { title: "E2E Orphan", slug: `e2e-orphan-${crypto.randomUUID()}`, summary: "s", blocks: [{ id: "b1", type: "text", html: "<p>x</p>" }], icon: null, imageAssetId: null, seoTitle: null, seoDescription: null },
      createdBy: e2eAdmin.id,
    });
    if (!orphanedDraft.ok) throw new Error("unreachable");

    // A mixed-author entity: real admin published, E2E actor later
    // drafted on top - must never be deleted outright (unlike a singleton,
    // an ordinary entity has no "reset just the draft" concept here; the
    // presence of any genuinely admin-authored revision is enough to
    // exclude the whole entity from this rule).
    const mixedEntity = await client.contentEntity.create({ data: { contentType: "service", provenance: "authored" } });
    const mixedTranslation = await client.contentTranslation.create({ data: { entityId: mixedEntity.id, locale: "tr" } });
    const mixedPublishDraft = await saveDraft(client, {
      translationId: mixedTranslation.id,
      expectedVersion: mixedTranslation.version,
      schemaVersion: SERVICE_SCHEMA_VERSION,
      payload: { title: "Real", slug: `real-mixed-${crypto.randomUUID()}`, summary: "s", blocks: [{ id: "b1", type: "text", html: "<p>x</p>" }], icon: null, imageAssetId: null, seoTitle: null, seoDescription: null },
      createdBy: realAdmin.id,
    });
    if (!mixedPublishDraft.ok) throw new Error("unreachable");
    const mixedPublish = await publish(client, {
      translationId: mixedTranslation.id,
      expectedVersion: mixedPublishDraft.translation.version,
      expectedDraftRevisionId: mixedPublishDraft.revisionId,
    });
    if (!mixedPublish.ok) throw new Error("unreachable");
    const mixedE2eDraft = await saveDraft(client, {
      translationId: mixedTranslation.id,
      expectedVersion: mixedPublish.translation.version,
      schemaVersion: SERVICE_SCHEMA_VERSION,
      payload: { title: "E2E edit", slug: `real-mixed-${crypto.randomUUID()}`, summary: "s", blocks: [{ id: "b1", type: "text", html: "<p>x</p>" }], icon: null, imageAssetId: null, seoTitle: null, seoDescription: null },
      createdBy: e2eAdmin.id,
    });
    if (!mixedE2eDraft.ok) throw new Error("unreachable");

    // An entity with no revisions at all must never be attributed to anyone.
    const emptyEntity = await client.contentEntity.create({ data: { contentType: "service", provenance: "authored" } });

    const report = await computeResidueReport(client);

    expect(report.contentEntityIds).toContain(orphanedEntity.id);
    expect(report.contentEntityIds).not.toContain(mixedEntity.id);
    expect(report.contentEntityIds).not.toContain(emptyEntity.id);

    await applyResidueCleanup(client, report);

    expect(await client.contentEntity.findUnique({ where: { id: orphanedEntity.id } })).toBeNull();
    expect(await client.contentEntity.findUnique({ where: { id: mixedEntity.id } })).not.toBeNull();
    expect(await client.contentEntity.findUnique({ where: { id: emptyEntity.id } })).not.toBeNull();
  });

  test("content authored by an actor whose AdminUser row was already deleted (dangling createdBy) is removed; a legacy-backfill/system marker is never touched", async ({ testDatabase }) => {
    const { client } = testDatabase;
    const vanishedActorId = `cm${crypto.randomUUID().replace(/-/g, "")}`.slice(0, 25);

    const danglingEntity = await client.contentEntity.create({ data: { contentType: "post", provenance: "authored" } });
    const danglingTranslation = await client.contentTranslation.create({ data: { entityId: danglingEntity.id, locale: "tr" } });
    const danglingDraft = await saveDraft(client, {
      translationId: danglingTranslation.id,
      expectedVersion: danglingTranslation.version,
      schemaVersion: POST_SCHEMA_VERSION,
      payload: { title: "Dangling", slug: `dangling-${crypto.randomUUID()}`, excerpt: "e", blocks: [{ id: "b1", type: "text", html: "<p>x</p>" }], category: "c", author: "a", coverImageAssetId: null, seoTitle: null, seoDescription: null },
      createdBy: vanishedActorId,
    });
    if (!danglingDraft.ok) throw new Error("unreachable");

    const backfilledEntity = await client.contentEntity.create({ data: { contentType: "service", provenance: "legacy-backfill" } });
    const backfilledTranslation = await client.contentTranslation.create({ data: { entityId: backfilledEntity.id, locale: "tr" } });
    const backfillDraft = await saveDraft(client, {
      translationId: backfilledTranslation.id,
      expectedVersion: backfilledTranslation.version,
      schemaVersion: SERVICE_SCHEMA_VERSION,
      payload: { title: "Backfilled", slug: `backfilled-${crypto.randomUUID()}`, summary: "s", blocks: [{ id: "b1", type: "text", html: "<p>x</p>" }], icon: null, imageAssetId: null, seoTitle: null, seoDescription: null },
      createdBy: "legacy-backfill:service-v1",
    });
    if (!backfillDraft.ok) throw new Error("unreachable");

    const report = await computeResidueReport(client);

    expect(report.contentEntityIds).toContain(danglingEntity.id);
    expect(report.contentEntityIds).not.toContain(backfilledEntity.id);

    await applyResidueCleanup(client, report);

    expect(await client.contentEntity.findUnique({ where: { id: danglingEntity.id } })).toBeNull();
    expect(await client.contentEntity.findUnique({ where: { id: backfilledEntity.id } })).not.toBeNull();
  });
});
