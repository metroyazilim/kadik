import { expect, test } from "../support/merged-fixtures";
import { createEntity, createTranslation } from "../../lib/content-model/model";
import { saveDraft, publish } from "../../lib/content-model/publishing";
import {
  SERVICE_FIXTURE_CONTENT_TYPE,
  SERVICE_FIXTURE_SCHEMA_VERSION,
} from "../../lib/content-model/payload-validation";
import type { RouteCandidate } from "../../lib/content-model/route-registry";
import { getPublishedRouteCandidates } from "../../lib/content-model/route-reader";
import {
  getPublishedRouteCandidatesBySlug,
  getPublishedRouteCandidatesByTurkishSlug,
} from "../../lib/content-model/route-reader";
import { resolveRouteIdentity } from "../../lib/content-model/public-route-resolution";

test.setTimeout(120_000);

const SEGMENTS = {
  tr: "servisler",
  en: "services",
} as const;

async function publishWithRoute(
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
    createdBy: "story-5-2-fixture",
  });
  if (!draft.ok) throw new Error("fixture draft unexpectedly conflicted");
  const candidate: RouteCandidate = {
    contentType: SERVICE_FIXTURE_CONTENT_TYPE,
    locale,
    collectionSegment: SEGMENTS[locale],
    slug,
  };
  const published = await publish(
    client,
    {
      translationId: translation.id,
      expectedVersion: draft.translation.version,
      expectedDraftRevisionId: draft.revisionId,
    },
    undefined,
    { candidate },
  );
  if (!published.ok) throw new Error("fixture publish unexpectedly conflicted");
}

test.describe("Story 5.2 - Prisma-touching route candidate readers", () => {
  test("CAP-1 getPublishedRouteCandidatesBySlug finds the exact quadruple and returns an empty array for a non-matching one", async ({
    testDatabase,
  }) => {
    const { client } = testDatabase;
    const entity = await createEntity(client, { contentType: SERVICE_FIXTURE_CONTENT_TYPE });
    await publishWithRoute(client, entity.id, "en", "reader-slug-en");

    const found = await getPublishedRouteCandidatesBySlug(
      client,
      SERVICE_FIXTURE_CONTENT_TYPE,
      "en",
      SEGMENTS.en,
      "reader-slug-en",
    );
    expect(found.map((route) => route.entityId)).toEqual([entity.id]);

    const notFound = await getPublishedRouteCandidatesBySlug(
      client,
      SERVICE_FIXTURE_CONTENT_TYPE,
      "en",
      SEGMENTS.en,
      "does-not-exist",
    );
    expect(notFound).toEqual([]);
  });

  test("CAP-2 getPublishedRouteCandidatesByTurkishSlug only matches published Turkish rows for the given content type", async ({
    testDatabase,
  }) => {
    const { client } = testDatabase;
    const entity = await createEntity(client, { contentType: SERVICE_FIXTURE_CONTENT_TYPE });
    await publishWithRoute(client, entity.id, "tr", "reader-slug-tr");

    const found = await getPublishedRouteCandidatesByTurkishSlug(
      client,
      SERVICE_FIXTURE_CONTENT_TYPE,
      "reader-slug-tr",
    );
    expect(found).toHaveLength(1);
    expect(found[0].entityId).toBe(entity.id);
    expect(found[0].locale).toBe("tr");

    const wrongContentType = await getPublishedRouteCandidatesByTurkishSlug(
      client,
      "some-other-content-type",
      "reader-slug-tr",
    );
    expect(wrongContentType).toEqual([]);
  });

  test("Prisma-touching readers only return published rows, mirroring getPublishedRouteCandidates's own invariant", async ({
    testDatabase,
  }) => {
    const { client } = testDatabase;
    const entity = await createEntity(client, { contentType: SERVICE_FIXTURE_CONTENT_TYPE });
    const translation = await createTranslation(client, { entityId: entity.id, locale: "en" });
    const draft = await saveDraft(client, {
      translationId: translation.id,
      expectedVersion: translation.version,
      schemaVersion: SERVICE_FIXTURE_SCHEMA_VERSION,
      payload: { title: "Draft only", slug: "never-published", category: "audit", order: 0 },
      createdBy: "story-5-2-fixture",
    });
    if (!draft.ok) throw new Error("draft unexpectedly conflicted");

    const found = await getPublishedRouteCandidatesBySlug(
      client,
      SERVICE_FIXTURE_CONTENT_TYPE,
      "en",
      SEGMENTS.en,
      "never-published",
    );
    expect(found).toEqual([]);
  });

  test("Prisma-touching readers never surface a route for an archived entity, even though ContentRoute still has the row", async ({
    testDatabase,
  }) => {
    const { client } = testDatabase;
    const entity = await createEntity(client, { contentType: SERVICE_FIXTURE_CONTENT_TYPE });
    await publishWithRoute(client, entity.id, "en", "archived-reader-slug");
    await publishWithRoute(client, entity.id, "tr", "archived-reader-slug-tr");
    await client.contentEntity.update({ where: { id: entity.id }, data: { archived: true } });

    expect(
      await getPublishedRouteCandidatesBySlug(client, SERVICE_FIXTURE_CONTENT_TYPE, "en", SEGMENTS.en, "archived-reader-slug"),
    ).toEqual([]);
    expect(
      await getPublishedRouteCandidatesByTurkishSlug(client, SERVICE_FIXTURE_CONTENT_TYPE, "archived-reader-slug-tr"),
    ).toEqual([]);
  });
});

test.describe("Story 5.2 - end-to-end reverse resolution against real published data", () => {
  test("CAP-1/CAP-2 a Service entity published in tr and en resolves its Global native path and Turkish-slug fallback alias", async ({
    testDatabase,
  }) => {
    const { client } = testDatabase;
    const entity = await createEntity(client, { contentType: SERVICE_FIXTURE_CONTENT_TYPE });
    await publishWithRoute(client, entity.id, "tr", "e2e-slug");
    await publishWithRoute(client, entity.id, "en", "e2e-slug-en");

    const nativeCandidates = await getPublishedRouteCandidatesBySlug(
      client,
      SERVICE_FIXTURE_CONTENT_TYPE,
      "en",
      SEGMENTS.en,
      "e2e-slug-en",
    );
    const nativeResult = resolveRouteIdentity(
      { contentType: SERVICE_FIXTURE_CONTENT_TYPE, locale: "en", collectionSegment: SEGMENTS.en, slug: "e2e-slug-en" },
      nativeCandidates,
      [],
    );
    expect(nativeResult).toEqual({
      kind: "native",
      entityId: entity.id,
      url: "/en/services/e2e-slug-en",
    });

    const turkishCandidates = await getPublishedRouteCandidatesByTurkishSlug(
      client,
      SERVICE_FIXTURE_CONTENT_TYPE,
      "e2e-slug",
    );
    const fallbackResult = resolveRouteIdentity(
      { contentType: SERVICE_FIXTURE_CONTENT_TYPE, locale: "en", collectionSegment: SEGMENTS.en, slug: "e2e-slug" },
      [],
      turkishCandidates,
    );
    expect(fallbackResult).toEqual({
      kind: "fallbackAlias",
      entityId: entity.id,
      canonical: "/servisler/e2e-slug",
      noindex: true,
    });

    const unknownResult = resolveRouteIdentity(
      { contentType: SERVICE_FIXTURE_CONTENT_TYPE, locale: "en", collectionSegment: SEGMENTS.en, slug: "totally-unknown-slug" },
      [],
      [],
    );
    expect(unknownResult).toEqual({ kind: "notFound" });
  });

  test("CAP-1 getPublishedRouteCandidates (Story 0.4, unmodified) still backs resolvePublicRoute's own forward direction identically", async ({
    testDatabase,
  }) => {
    const { client } = testDatabase;
    const entity = await createEntity(client, { contentType: SERVICE_FIXTURE_CONTENT_TYPE });
    await publishWithRoute(client, entity.id, "tr", "forward-check-slug");
    const routes = await getPublishedRouteCandidates(client, entity.id);
    expect(routes).toEqual([
      {
        entityId: entity.id,
        contentType: SERVICE_FIXTURE_CONTENT_TYPE,
        locale: "tr",
        collectionSegment: SEGMENTS.tr,
        slug: "forward-check-slug",
      },
    ]);
  });
});
