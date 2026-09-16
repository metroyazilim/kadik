import { expect, test } from "../support/merged-fixtures";
import {
  snapshotSiteSettings,
  restoreSiteSettings,
  snapshotContactRateLimitIds,
  deleteNewContactRateLimitRows,
} from "../support/fixtures/e2e-data-fixture";
import { ensureSiteSettingsEntity } from "../../lib/content-model/site-settings-registry";
import { saveDraft, publish } from "../../lib/content-model/publishing";
import { SITE_SETTINGS_SCHEMA_VERSION } from "../../lib/content-model/site-settings-schema";

test.setTimeout(60_000);

test.describe("Spec 5 - e2eData fixture singleton/rate-limit cleanup (AC-5.9/AC-5.11)", () => {
  test("restoring the site-settings singleton deletes the E2E revision rows it created, not just the pointer", async ({
    testDatabase,
  }) => {
    const { client } = testDatabase;
    const admin = await client.adminUser.create({
      data: { email: "gercek.admin@example-starter.com", passwordHash: "x", name: "Gerçek Admin" },
    });
    const { entityId } = await ensureSiteSettingsEntity(client);
    const translation = await client.contentTranslation.findUniqueOrThrow({
      where: { entityId_locale: { entityId, locale: "tr" } },
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
      createdBy: admin.id,
    });
    if (!realDraft.ok) throw new Error("unreachable");
    const realPublish = await publish(client, {
      translationId: translation.id,
      expectedVersion: realDraft.translation.version,
      expectedDraftRevisionId: realDraft.revisionId,
    });
    if (!realPublish.ok) throw new Error("unreachable");
    const preExistingRevisionCount = await client.contentTranslationRevision.count({ where: { translationId: translation.id } });

    // The fixture snapshots BEFORE the "test" runs its own saveDraft/publish cycle.
    const snapshot = await snapshotSiteSettings(client);

    const e2eDraft = await saveDraft(client, {
      translationId: translation.id,
      expectedVersion: realPublish.translation.version,
      schemaVersion: SITE_SETTINGS_SCHEMA_VERSION,
      payload: { ...realPayload, brand: { name: "E2E marker marka", logoAssetId: null } },
      createdBy: admin.id,
    });
    if (!e2eDraft.ok) throw new Error("unreachable");
    const e2ePublish = await publish(client, {
      translationId: translation.id,
      expectedVersion: e2eDraft.translation.version,
      expectedDraftRevisionId: e2eDraft.revisionId,
    });
    if (!e2ePublish.ok) throw new Error("unreachable");
    // publish() only repoints publishedRevisionId; it never inserts a row -
    // saveDraft is the only insert, so exactly one new revision exists.
    expect(await client.contentTranslationRevision.count({ where: { translationId: translation.id } })).toBe(
      preExistingRevisionCount + 1,
    );

    await restoreSiteSettings(client, snapshot);

    // Pointer restored to the real, pre-test publish...
    const restored = await client.contentTranslation.findUniqueOrThrow({ where: { id: translation.id } });
    expect(restored.publishedRevisionId).toBe(realPublish.translation.publishedRevisionId);
    expect(restored.version).toBe(realPublish.translation.version);
    // ...and both revision rows the "test" created are gone, not just repointed away from.
    expect(await client.contentTranslationRevision.count({ where: { translationId: translation.id } })).toBe(
      preExistingRevisionCount,
    );
    expect(await client.contentTranslationRevision.findUnique({ where: { id: e2eDraft.revisionId } })).toBeNull();
    expect(await client.contentTranslationRevision.findUnique({ where: { id: e2ePublish.translation.publishedRevisionId as string } })).toBeNull();
    // The real, pre-test revision itself is untouched.
    expect(
      await client.contentTranslationRevision.findUnique({ where: { id: realPublish.translation.publishedRevisionId as string } }),
    ).not.toBeNull();
  });

  test("the rate-limit snapshot/diff deletes only windows created after the snapshot, never a pre-existing real visitor window", async ({
    testDatabase,
  }) => {
    const { client } = testDatabase;
    const realWindow = await client.contactRateLimit.create({
      data: { scope: "contact-form-submit", bucketKey: "real-visitor-hash", windowStart: new Date("2026-01-01T00:00:00Z"), count: 3 },
    });

    const snapshot = await snapshotContactRateLimitIds(client);

    const e2eWindow = await client.contactRateLimit.create({
      data: { scope: "contact-form-submit", bucketKey: "e2e-probe-hash", windowStart: new Date("2026-01-01T01:00:00Z"), count: 5 },
    });
    // A real visitor's window can also be incremented (same row, same id) during the test window - must survive.
    await client.contactRateLimit.update({ where: { id: realWindow.id }, data: { count: { increment: 1 } } });

    await deleteNewContactRateLimitRows(client, snapshot);

    expect(await client.contactRateLimit.findUnique({ where: { id: e2eWindow.id } })).toBeNull();
    const survivingReal = await client.contactRateLimit.findUnique({ where: { id: realWindow.id } });
    expect(survivingReal).not.toBeNull();
    expect(survivingReal?.count).toBe(4);
  });
});
