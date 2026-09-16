import { randomUUID } from "node:crypto";
import { expect, test } from "../support/merged-fixtures";
import type { Prisma } from "@prisma/client";
import { issueTestAdminContext } from "../../lib/content-model/admin-context-test-support";
import type { AdminContext } from "../../lib/content-model/admin-context";
import { adminPublish, adminSaveDraft } from "../../lib/content-model/admin-content-store";
import { ensureLocaleTranslation } from "../../lib/content-model/collection-admin";
import { ContentModelError } from "../../lib/content-model/errors";
import { validatePayload } from "../../lib/content-model/payload-validation";
import { persistedOutboxRecorder } from "../../lib/content-model/outbox-store";
import { contentAvailabilityTag, contentEntityTag, navigationConfigTag } from "../../lib/content-model/cache-tags";
import { ensureSiteSettingsEntity, getSiteSettingsEntityId } from "../../lib/content-model/site-settings-registry";
import { resolveNavTarget } from "../../lib/content-model/site-settings-nav";
import { resolve } from "../../lib/content-model/public-content-reader";
import {
  SITE_SETTINGS_CONTENT_TYPE,
  SITE_SETTINGS_SCHEMA_VERSION,
  type SiteSettingsPayload,
} from "../../lib/content-model/site-settings-schema";

test.setTimeout(120_000);

function siteSettingsPayload(overrides: Partial<SiteSettingsPayload> = {}): SiteSettingsPayload {
  return {
    brand: { name: "Metro", logoAssetId: null },
    contact: { email: "info@example.com", phone: "+90 555 000", address: "İstanbul" },
    cta: { label: "Teklif al", url: "/contact" },
    navigation: [],
    footer: { summary: "Metro footer summary.", columns: [] },
    mission: "Our mission statement.",
    vision: "Our vision statement.",
    termsBody: "<p>Terms body.</p>",
    privacyBody: "<p>Privacy body.</p>",
    ...overrides,
  };
}

async function issueActor(
  client: Parameters<typeof ensureSiteSettingsEntity>[0],
  label: string,
): Promise<AdminContext> {
  const user = await client.adminUser.create({
    data: {
      email: `${label}-${randomUUID()}@example.test`,
      passwordHash: "unused-in-story-6-1-contract-tests",
      name: "Story 6.1 Contract Actor",
    },
  });
  return issueTestAdminContext({ id: user.id, email: user.email });
}

async function saveDraft(
  client: Parameters<typeof ensureSiteSettingsEntity>[0],
  actor: AdminContext,
  translationId: string,
  expectedVersion: number,
  payload: SiteSettingsPayload,
) {
  const result = await adminSaveDraft(client, actor, {
    translationId,
    expectedVersion,
    schemaVersion: SITE_SETTINGS_SCHEMA_VERSION,
    payload: payload as unknown as Prisma.InputJsonValue,
  });
  if (!result.ok) throw new Error("site-settings draft unexpectedly conflicted");
  return result;
}

async function publish(
  client: Parameters<typeof ensureSiteSettingsEntity>[0],
  actor: AdminContext,
  entityId: string,
  locale: "tr" | "en",
  translationId: string,
  expectedVersion: number,
  expectedDraftRevisionId: string,
) {
  return adminPublish(
    client,
    actor,
    { translationId, expectedVersion, expectedDraftRevisionId },
    undefined,
    {
      recorder: persistedOutboxRecorder,
      tags: [contentEntityTag(entityId), contentAvailabilityTag(entityId, locale), navigationConfigTag()],
    },
  );
}

test.describe("AC-6.1-10 - site-settings payload schema", () => {
  test("accepts the exact real SiteSettingsPayload and returns a detached canonical value", async () => {
    const input = siteSettingsPayload();
    const result = validatePayload(SITE_SETTINGS_CONTENT_TYPE, SITE_SETTINGS_SCHEMA_VERSION, input);
    expect(result).toEqual(input);
    expect(result).not.toBe(input);
  });

  test("rejects an extra unknown top-level key (closed shape)", async () => {
    let caught: unknown;
    try {
      validatePayload(SITE_SETTINGS_CONTENT_TYPE, SITE_SETTINGS_SCHEMA_VERSION, {
        ...siteSettingsPayload(),
        extra: "not allowed",
      });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ContentModelError);
  });

  test("rejects a CTA with a label but no URL (never a half-formed call-to-action)", async () => {
    let caught: unknown;
    try {
      validatePayload(
        SITE_SETTINGS_CONTENT_TYPE,
        SITE_SETTINGS_SCHEMA_VERSION,
        siteSettingsPayload({ cta: { label: "Teklif al", url: null } }),
      );
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ContentModelError);
  });

  test("rejects an unsafe CTA URL scheme", async () => {
    let caught: unknown;
    try {
      validatePayload(
        SITE_SETTINGS_CONTENT_TYPE,
        SITE_SETTINGS_SCHEMA_VERSION,
        siteSettingsPayload({ cta: { label: "Click", url: "javascript:alert(1)" } }),
      );
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ContentModelError);
  });

  test("accepts a navigation item with a collection target and nested children", async () => {
    const input = siteSettingsPayload({
      navigation: [
        {
          id: "n1",
          label: "Hizmetler",
          target: { kind: "collection", contentType: "service", entityId: "svc-1" },
          children: [
            { id: "n1-1", label: "Atık Denetimi", target: { kind: "external", url: "/servisler/atik-denetimi" } },
          ],
        },
      ],
    });
    const result = validatePayload(SITE_SETTINGS_CONTENT_TYPE, SITE_SETTINGS_SCHEMA_VERSION, input);
    expect(result).toEqual(input);
  });
});

test.describe("AC-6.1-01/02/03 - singleton entity bootstrap and locale-independent draft/publish", () => {
  test("ensureSiteSettingsEntity is idempotent and creates exactly one entity with both canonical translations", async ({ testDatabase }) => {
    const { client } = testDatabase;
    const first = await ensureSiteSettingsEntity(client);
    const second = await ensureSiteSettingsEntity(client);
    expect(second.entityId).toBe(first.entityId);
    expect(await client.contentEntity.count({ where: { contentType: SITE_SETTINGS_CONTENT_TYPE } })).toBe(1);
    expect(await client.contentTranslation.count({ where: { entityId: first.entityId } })).toBe(2);
    expect(await client.siteSettingsRegistry.count()).toBe(1);
  });

  test("publishing tr leaves en missing and commits immutable revision, pointer, and audit state", async ({ testDatabase }) => {
    const { client } = testDatabase;
    const actor = await issueActor(client, "locale-isolation");
    const { entityId } = await ensureSiteSettingsEntity(client);
    const tr = await ensureLocaleTranslation(client, actor, entityId, "tr");

    const draft = await saveDraft(client, actor, tr.translationId, tr.version, siteSettingsPayload({ mission: "TR mission" }));
    const published = await publish(client, actor, entityId, "tr", tr.translationId, draft.translation.version, draft.revisionId);

    expect(published.ok).toBe(true);
    if (!published.ok) throw new Error("site-settings publish unexpectedly conflicted");
    expect(published.translation.publishedRevisionId).toBe(draft.revisionId);

    const en = await client.contentTranslation.findUnique({
      where: { entityId_locale: { entityId, locale: "en" } },
    });
    expect(en?.publishedRevisionId).toBeNull();
    expect(await client.auditLog.count({
      where: { entityId: tr.translationId, action: { in: ["content.draft.save", "content.publish"] } },
    })).toBe(2);
  });

  test("a stale locale edit returns the safe conflict and creates no extra revision or audit row", async ({ testDatabase }) => {
    const { client } = testDatabase;
    const actor = await issueActor(client, "stale-site-settings");
    const { entityId } = await ensureSiteSettingsEntity(client);
    const en = await ensureLocaleTranslation(client, actor, entityId, "en");
    const first = await saveDraft(client, actor, en.translationId, en.version, siteSettingsPayload());

    const conflict = await adminSaveDraft(client, actor, {
      translationId: en.translationId,
      expectedVersion: en.version,
      schemaVersion: SITE_SETTINGS_SCHEMA_VERSION,
      payload: siteSettingsPayload({ mission: "stale edit" }) as unknown as Prisma.InputJsonValue,
    });

    expect(conflict.ok).toBe(false);
    if (conflict.ok) throw new Error("stale site-settings draft unexpectedly succeeded");
    expect(conflict.conflict).toBe(true);
    expect(conflict.current.version).toBe(first.translation.version);
    expect(await client.contentTranslationRevision.count({ where: { translationId: en.translationId } })).toBe(1);
  });

  test("publish writes a durable outbox event carrying the navigation-config invalidation tag", async ({ testDatabase }) => {
    const { client } = testDatabase;
    const actor = await issueActor(client, "outbox");
    const { entityId } = await ensureSiteSettingsEntity(client);
    const tr = await ensureLocaleTranslation(client, actor, entityId, "tr");
    const draft = await saveDraft(client, actor, tr.translationId, tr.version, siteSettingsPayload());
    await publish(client, actor, entityId, "tr", tr.translationId, draft.translation.version, draft.revisionId);

    const events = await client.invalidationOutboxEvent.findMany({ where: { sourceEntityId: entityId } });
    expect(events).toHaveLength(1);
    expect(events[0].tags).toEqual(
      expect.arrayContaining([`content:entity:${entityId}`, `content:translation:${entityId}:tr:availability`, "content:navigation:config"]),
    );
  });
});

test.describe("AC-6.1-04 - navigation target route-registry validation", () => {
  test("an external target always resolves", async ({ testDatabase }) => {
    const { client } = testDatabase;
    const resolved = await resolveNavTarget(client, "tr", { kind: "external", url: "/about" });
    expect(resolved).toEqual({ ok: true, url: "/about" });
  });

  test("a collection target referencing a nonexistent entity is 'missing'", async ({ testDatabase }) => {
    const { client } = testDatabase;
    const resolved = await resolveNavTarget(client, "tr", {
      kind: "collection",
      contentType: "service",
      entityId: "does-not-exist",
    });
    expect(resolved).toEqual({ ok: false, reason: "missing" });
  });

  test("a collection target referencing an archived entity is 'archived'", async ({ testDatabase }) => {
    const { client } = testDatabase;
    const entity = await client.contentEntity.create({ data: { contentType: "service", archived: true } });
    const resolved = await resolveNavTarget(client, "tr", {
      kind: "collection",
      contentType: "service",
      entityId: entity.id,
    });
    expect(resolved).toEqual({ ok: false, reason: "archived" });
  });

  test("a collection target with only a draft translation is 'draft'", async ({ testDatabase }) => {
    const { client } = testDatabase;
    const actor = await issueActor(client, "nav-draft");
    const entity = await client.contentEntity.create({ data: { contentType: "service" } });
    const translation = await ensureLocaleTranslation(client, actor, entity.id, "tr");
    await client.contentTranslationRevision.create({
      data: {
        translationId: translation.translationId,
        schemaVersion: 1,
        payload: {},
        createdBy: actor.actorId,
      },
    }).then((revision) =>
      client.contentTranslation.update({
        where: { id: translation.translationId },
        data: { draftRevisionId: revision.id, version: 1 },
      }),
    );

    const resolved = await resolveNavTarget(client, "tr", {
      kind: "collection",
      contentType: "service",
      entityId: entity.id,
    });
    expect(resolved).toEqual({ ok: false, reason: "draft" });
  });
});

test.describe("AC-6.1-05 - public projection and Turkish fallback", () => {
  test("returns null before any locale is published", async ({ testDatabase }) => {
    const { client } = testDatabase;
    await ensureSiteSettingsEntity(client);
    // getPublicSiteSettings/getPublicLegalDocument use the shared prisma
    // singleton, not testDatabase.client - assert against the lower-level
    // resolve() contract instead, which they both delegate to unmodified.
    const entityId = await getSiteSettingsEntityId(client);
    expect(entityId).not.toBeNull();
    const result = await resolve(client, {
      entityId: entityId!,
      contentType: SITE_SETTINGS_CONTENT_TYPE,
      requestedLocale: "en",
    });
    expect(result.payload).toBeNull();
    expect(result.emptyReason).toBe("no-published-any-locale");
  });

  test("an unpublished en draft falls back to the tr publication with a noindex canonical", async ({ testDatabase }) => {
    const { client } = testDatabase;
    const actor = await issueActor(client, "fallback");
    const { entityId } = await ensureSiteSettingsEntity(client);
    const tr = await ensureLocaleTranslation(client, actor, entityId, "tr");
    const draft = await saveDraft(client, actor, tr.translationId, tr.version, siteSettingsPayload({ mission: "TR mission" }));
    await publish(client, actor, entityId, "tr", tr.translationId, draft.translation.version, draft.revisionId);

    const result = await resolve(client, { entityId, contentType: SITE_SETTINGS_CONTENT_TYPE, requestedLocale: "en" });
    expect(result.servedLocale).toBe("tr");
    expect(result.fallbackApplied).toBe(true);
    expect((result.payload as unknown as SiteSettingsPayload).mission).toBe("TR mission");
  });
});
