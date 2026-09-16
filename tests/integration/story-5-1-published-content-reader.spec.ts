import { expect, test } from "../support/merged-fixtures";
import { createEntity, createTranslation } from "../../lib/content-model/model";
import { saveDraft, publish } from "../../lib/content-model/publishing";
import {
  SERVICE_FIXTURE_CONTENT_TYPE,
  SERVICE_FIXTURE_SCHEMA_VERSION,
} from "../../lib/content-model/payload-validation";
import * as publicContentReader from "../../lib/content-model/public-content-reader";
import { resolve } from "../../lib/content-model/public-content-reader";
import { PublishedContentStore, type PublishedContentSource } from "../../lib/content-model/published-content-store";
import {
  contentAvailabilityTag,
  contentEntityTag,
  contentRevisionTag,
} from "../../lib/content-model/cache-tags";

test.setTimeout(120_000);

const COLLECTION_SEGMENT: Record<"tr" | "en", string> = {
  tr: "servisler",
  en: "services",
};

async function publishFixture(
  client: Parameters<typeof createEntity>[0],
  entityId: string,
  locale: "tr" | "en",
  slug: string,
) {
  const translation = await createTranslation(client, { entityId, locale });
  const draft = await saveDraft(client, {
    translationId: translation.id,
    expectedVersion: translation.version,
    schemaVersion: SERVICE_FIXTURE_SCHEMA_VERSION,
    payload: { title: `Fixture ${slug}`, slug, category: "audit", order: 0 },
    createdBy: "story-5-1-fixture",
  });
  if (!draft.ok) throw new Error("fixture draft unexpectedly conflicted");
  const published = await publish(
    client,
    {
      translationId: translation.id,
      expectedVersion: draft.translation.version,
      expectedDraftRevisionId: draft.revisionId,
    },
    undefined,
    { candidate: { contentType: SERVICE_FIXTURE_CONTENT_TYPE, locale, collectionSegment: COLLECTION_SEGMENT[locale], slug } },
  );
  if (!published.ok) throw new Error("fixture publish unexpectedly conflicted");
  return { translationId: translation.id, revisionId: draft.revisionId, version: published.translation.version };
}

test.describe("AC-5.1-01 - native and Turkish-fallback resolution", () => {
  test("CAP-1 resolve() returns the native payload with fallbackApplied:false when the requested locale is published", async ({
    testDatabase,
  }) => {
    const { client } = testDatabase;
    const entity = await createEntity(client, { contentType: SERVICE_FIXTURE_CONTENT_TYPE });
    const { revisionId } = await publishFixture(client, entity.id, "en", "waste-audit-en");

    const result = await resolve(client, {
      entityId: entity.id,
      contentType: SERVICE_FIXTURE_CONTENT_TYPE,
      requestedLocale: "en",
    });

    expect(result.fallbackApplied).toBe(false);
    expect(result.servedLocale).toBe("en");
    expect(result.servedRevisionId).toBe(revisionId);
    expect(result.emptyReason).toBeNull();
    expect(result.canonical).toBeNull();
    expect((result.payload as Record<string, unknown>).slug).toBe("waste-audit-en");
  });

  test("CAP-1 resolve() falls back to the published Turkish payload when the requested locale has no translation, with canonical/noindex set to this entity's own Turkish route", async ({
    testDatabase,
  }) => {
    const { client } = testDatabase;
    const entity = await createEntity(client, { contentType: SERVICE_FIXTURE_CONTENT_TYPE });
    const { revisionId } = await publishFixture(client, entity.id, "tr", "atik-denetimi");

    const result = await resolve(client, {
      entityId: entity.id,
      contentType: SERVICE_FIXTURE_CONTENT_TYPE,
      requestedLocale: "en",
    });

    expect(result.fallbackApplied).toBe(true);
    expect(result.servedLocale).toBe("tr");
    expect(result.servedRevisionId).toBe(revisionId);
    expect(result.emptyReason).toBeNull();
    expect(result.canonical).toEqual({ url: "/servisler/atik-denetimi", noindex: true });
  });

  test("CAP-1 a Turkish request never issues a redundant second Turkish lookup - no fallback is attempted against itself", async ({
    testDatabase,
  }) => {
    const { client } = testDatabase;
    const entity = await createEntity(client, { contentType: SERVICE_FIXTURE_CONTENT_TYPE });

    const result = await resolve(client, {
      entityId: entity.id,
      contentType: SERVICE_FIXTURE_CONTENT_TYPE,
      requestedLocale: "tr",
    });

    expect(result.emptyReason).toBe("no-published-any-locale");
    // Only one availability tag (tr==requested) - never a duplicated tr tag
    // from a second, redundant lookup against the same locale.
    const availabilityTags = result.cacheDependencies.tags.filter((tag) => tag.includes(":availability"));
    expect(availabilityTags).toEqual([contentAvailabilityTag(entity.id, "tr")]);
  });
});

test.describe("AC-5.1-02 - safe classified empty result", () => {
  test("CAP-1 resolve() returns a full CacheDependencySet and no payload/exception when neither the requested locale nor Turkish is published", async ({
    testDatabase,
  }) => {
    const { client } = testDatabase;
    const entity = await createEntity(client, { contentType: SERVICE_FIXTURE_CONTENT_TYPE });

    const result = await resolve(client, {
      entityId: entity.id,
      contentType: SERVICE_FIXTURE_CONTENT_TYPE,
      requestedLocale: "en",
    });

    expect(result.emptyReason).toBe("no-published-any-locale");
    expect(result.payload).toBeNull();
    expect(result.servedLocale).toBeNull();
    expect(result.cacheDependencies.tags.length).toBeGreaterThan(0);
    expect(result.cacheDependencies.tags).toContain(contentEntityTag(entity.id));
    expect(result.cacheDependencies.tags).toContain(contentAvailabilityTag(entity.id, "en"));
    expect(result.cacheDependencies.tags).toContain(contentAvailabilityTag(entity.id, "tr"));
  });
});

test.describe("AC-5.1-03 - draft and archive invisibility", () => {
  test("CAP-1 a saved draft on top of a published revision never leaks - resolve() still serves the previously published payload", async ({
    testDatabase,
  }) => {
    const { client } = testDatabase;
    const entity = await createEntity(client, { contentType: SERVICE_FIXTURE_CONTENT_TYPE });
    const { translationId, revisionId, version } = await publishFixture(client, entity.id, "en", "published-slug");

    const staleDraft = await saveDraft(client, {
      translationId,
      expectedVersion: version,
      schemaVersion: SERVICE_FIXTURE_SCHEMA_VERSION,
      payload: { title: "Draft only", slug: "draft-only-slug", category: "audit", order: 0 },
      createdBy: "story-5-1-fixture",
    });
    if (!staleDraft.ok) throw new Error("draft-over-published save unexpectedly conflicted");

    const result = await resolve(client, {
      entityId: entity.id,
      contentType: SERVICE_FIXTURE_CONTENT_TYPE,
      requestedLocale: "en",
    });

    expect(result.servedRevisionId).toBe(revisionId);
    expect((result.payload as Record<string, unknown>).slug).toBe("published-slug");
  });

  test("CAP-1 an archived entity is rejected before either locale lookup runs, regardless of its publish pointers", async ({
    testDatabase,
  }) => {
    const { client } = testDatabase;
    const entity = await createEntity(client, { contentType: SERVICE_FIXTURE_CONTENT_TYPE });
    await publishFixture(client, entity.id, "tr", "archived-slug");
    await client.contentEntity.update({ where: { id: entity.id }, data: { archived: true } });

    const result = await resolve(client, {
      entityId: entity.id,
      contentType: SERVICE_FIXTURE_CONTENT_TYPE,
      requestedLocale: "en",
    });

    expect(result.payload).toBeNull();
    expect(result.servedLocale).toBeNull();
    expect(result.emptyReason).toBe("no-entity");
  });

  test("CAP-1 a caller-supplied contentType that does not match the entity's own stored contentType is rejected as no-entity, never trusted blindly", async ({
    testDatabase,
  }) => {
    const { client } = testDatabase;
    const entity = await createEntity(client, { contentType: SERVICE_FIXTURE_CONTENT_TYPE });
    await publishFixture(client, entity.id, "en", "mismatched-type-slug");

    const result = await resolve(client, {
      entityId: entity.id,
      contentType: "some-other-content-type",
      requestedLocale: "en",
    });

    expect(result.payload).toBeNull();
    expect(result.emptyReason).toBe("no-entity");
  });
});

test.describe("AC-5.1-04 - read-only structural isolation", () => {
  test("CAP-2 the resolve() module exposes no publish/saveDraft-shaped export and no method accepting a payload", () => {
    expect("publish" in publicContentReader).toBe(false);
    expect("saveDraft" in publicContentReader).toBe(false);
    expect("adminSaveDraft" in publicContentReader).toBe(false);
    expect("adminPublish" in publicContentReader).toBe(false);
  });
});

test.describe("AC-5.1-05 - safe error on dependency failure", () => {
  test("CAP-2 a PublishedContentSource that throws a raw storage error surfaces as a safe classified source-error result", async ({
    testDatabase,
  }) => {
    const { client } = testDatabase;
    const entity = await createEntity(client, { contentType: SERVICE_FIXTURE_CONTENT_TYPE });

    const failingSource: PublishedContentSource = {
      async getEntityState() {
        return { archived: false, contentType: SERVICE_FIXTURE_CONTENT_TYPE };
      },
      async getPublishedTranslation() {
        throw new Error("relation \"content_translation\" does not exist - raw pg driver error");
      },
      async getEntityRoutes() {
        return [];
      },
    };

    const result = await resolve(
      client,
      { entityId: entity.id, contentType: SERVICE_FIXTURE_CONTENT_TYPE, requestedLocale: "en" },
      failingSource,
    );

    expect(result.emptyReason).toBe("source-error");
    expect(result.payload).toBeNull();
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("relation");
    expect(serialized).not.toContain("pg driver");
  });

  test("CAP-2 a PublishedContentSource whose getEntityState itself throws also surfaces as a safe classified source-error result", async ({
    testDatabase,
  }) => {
    const { client } = testDatabase;
    const entity = await createEntity(client, { contentType: SERVICE_FIXTURE_CONTENT_TYPE });

    const failingSource: PublishedContentSource = {
      async getEntityState() {
        throw new Error("connection terminated unexpectedly - raw pg driver error");
      },
      async getPublishedTranslation() {
        return null;
      },
      async getEntityRoutes() {
        return [];
      },
    };

    const result = await resolve(
      client,
      { entityId: entity.id, contentType: SERVICE_FIXTURE_CONTENT_TYPE, requestedLocale: "en" },
      failingSource,
    );

    expect(result.emptyReason).toBe("source-error");
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("connection terminated");
  });
});

test.describe("AC-5.1-06 - cache-dependency tag parity with the outbox", () => {
  test("CAP-3 resolve()'s cacheDependencies tags match, by direct string comparison, what a Story 0.5-style outbox hook would emit for the same entity/locale/revision", async ({
    testDatabase,
  }) => {
    const { client } = testDatabase;
    const entity = await createEntity(client, { contentType: SERVICE_FIXTURE_CONTENT_TYPE });
    const { revisionId } = await publishFixture(client, entity.id, "en", "parity-slug");

    const result = await resolve(client, {
      entityId: entity.id,
      contentType: SERVICE_FIXTURE_CONTENT_TYPE,
      requestedLocale: "en",
    });

    const outboxStyleTags = [
      contentEntityTag(entity.id),
      contentAvailabilityTag(entity.id, "en"),
      contentRevisionTag(entity.id, "en", revisionId),
    ];

    expect([...result.cacheDependencies.tags].sort()).toEqual([...outboxStyleTags].sort());
  });
});

test.describe("Story 5.1 - PublishedContentStore production implementation", () => {
  test("CAP-1 PublishedContentStore.getEntityState returns null for a non-existent entity, and the real archived/contentType state otherwise", async ({
    testDatabase,
  }) => {
    const { client } = testDatabase;
    const store = new PublishedContentStore(client);
    expect(await store.getEntityState("does-not-exist")).toBeNull();

    const entity = await createEntity(client, { contentType: SERVICE_FIXTURE_CONTENT_TYPE });
    expect(await store.getEntityState(entity.id)).toEqual({
      archived: false,
      contentType: SERVICE_FIXTURE_CONTENT_TYPE,
    });

    await client.contentEntity.update({ where: { id: entity.id }, data: { archived: true } });
    expect(await store.getEntityState(entity.id)).toEqual({
      archived: true,
      contentType: SERVICE_FIXTURE_CONTENT_TYPE,
    });
  });

  test("CAP-1 PublishedContentStore.getEntityRoutes delegates to Story 0.4's getPublishedRouteCandidates - a published route is visible, an unpublished entity has none", async ({
    testDatabase,
  }) => {
    const { client } = testDatabase;
    const store = new PublishedContentStore(client);
    const entity = await createEntity(client, { contentType: SERVICE_FIXTURE_CONTENT_TYPE });
    expect(await store.getEntityRoutes(entity.id)).toEqual([]);

    await publishFixture(client, entity.id, "tr", "route-fixture-slug");
    const routes = await store.getEntityRoutes(entity.id);
    expect(routes).toEqual([
      {
        entityId: entity.id,
        contentType: SERVICE_FIXTURE_CONTENT_TYPE,
        locale: "tr",
        collectionSegment: "servisler",
        slug: "route-fixture-slug",
      },
    ]);
  });
});
