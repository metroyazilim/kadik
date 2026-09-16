import { expect, test } from "../support/merged-fixtures";
import { createEntity, createTranslation } from "../../lib/content-model/model";
import { saveDraft, publish } from "../../lib/content-model/publishing";
import {
  SERVICE_FIXTURE_CONTENT_TYPE,
  SERVICE_FIXTURE_SCHEMA_VERSION,
} from "../../lib/content-model/payload-validation";
import {
  generateRoute,
  resolvePublicRoute,
  type PublishedRoute,
  type RouteCandidate,
} from "../../lib/content-model/route-registry";
import { getPublishedRouteCandidates } from "../../lib/content-model/route-reader";
import { ContentModelError } from "../../lib/content-model/errors";

// No file-level `test.use({ runIdentity: ... })` override, matching Story
// 0.1/0.2/0.3's precedent - each test keeps its own auto-derived, per-test-id
// run identity so concurrent Playwright workers never share one isolated
// schema.
test.setTimeout(120_000);

const SEGMENTS = {
  tr: "servisler",
  en: "services",
} as const;

async function publishTranslation(
  client: Parameters<typeof createEntity>[0],
  translationId: string,
  expectedVersion: number,
  slugTr: string,
  candidateOverrides: Partial<RouteCandidate> = {},
) {
  const draft = await saveDraft(client, {
    translationId,
    expectedVersion,
    schemaVersion: SERVICE_FIXTURE_SCHEMA_VERSION,
    payload: { title: "Danışmanlık", slug: slugTr, category: "Hizmet", order: 0 },
    createdBy: "test:story-0-4",
  });
  if (!draft.ok) throw new Error("saveDraft unexpectedly conflicted");
  return publish(
    client,
    {
      translationId,
      expectedVersion: expectedVersion + 1,
      expectedDraftRevisionId: draft.revisionId,
    },
    undefined,
    {
      candidate: {
        contentType: SERVICE_FIXTURE_CONTENT_TYPE,
        locale: "tr",
        collectionSegment: SEGMENTS.tr,
        slug: slugTr,
        ...candidateOverrides,
      },
    },
  );
}

test.describe("AC-0.4-01 - native-script route generation on publish", () => {
  test("CAP-1/CAP-2 publishing with a route candidate reserves a ContentRoute row and returns the generated URL", async ({
    testDatabase,
  }) => {
    const { client } = testDatabase;
    const entity = await createEntity(client, { contentType: SERVICE_FIXTURE_CONTENT_TYPE });
    const translation = await createTranslation(client, { entityId: entity.id, locale: "tr" });

    const result = await publishTranslation(client, translation.id, 0, "atik-denetimi");
    if (!result.ok) throw new Error("publish unexpectedly conflicted");
    expect(result.route?.url).toBe("/servisler/atik-denetimi");

    const row = await client.contentRoute.findUniqueOrThrow({
      where: { translationId: translation.id },
    });
    expect(row.entityId).toBe(entity.id);
    expect(row.locale).toBe("tr");
    expect(row.collectionSegment).toBe(SEGMENTS.tr);
    expect(row.slug).toBe("atik-denetimi");
  });

  test("CAP-1 a draft-only translation (never published) has no ContentRoute row and never resolves publicly", async ({
    testDatabase,
  }) => {
    const { client } = testDatabase;
    const entity = await createEntity(client, { contentType: SERVICE_FIXTURE_CONTENT_TYPE });
    const translation = await createTranslation(client, { entityId: entity.id, locale: "tr" });
    await saveDraft(client, {
      translationId: translation.id,
      expectedVersion: 0,
      schemaVersion: SERVICE_FIXTURE_SCHEMA_VERSION,
      payload: { title: "Danışmanlık", slug: "atik-denetimi", category: "Hizmet", order: 0 },
      createdBy: "test:story-0-4",
    });

    expect(await client.contentRoute.count({ where: { translationId: translation.id } })).toBe(0);
    const routes = await getPublishedRouteCandidates(client, entity.id);
    expect(resolvePublicRoute(entity.id, "tr", routes)).toEqual({ kind: "notFound" });
  });

  test("CAP-2 calling publish() with no route argument never touches ContentRoute (Story 0.2/0.3 unaffected)", async ({
    testDatabase,
  }) => {
    const { client } = testDatabase;
    const entity = await createEntity(client, { contentType: SERVICE_FIXTURE_CONTENT_TYPE });
    const translation = await createTranslation(client, { entityId: entity.id, locale: "tr" });
    const draft = await saveDraft(client, {
      translationId: translation.id,
      expectedVersion: 0,
      schemaVersion: SERVICE_FIXTURE_SCHEMA_VERSION,
      payload: { title: "Danışmanlık", slug: "atik-denetimi", category: "Hizmet", order: 0 },
      createdBy: "test:story-0-4",
    });
    if (!draft.ok) throw new Error("saveDraft unexpectedly conflicted");
    const published = await publish(client, {
      translationId: translation.id,
      expectedVersion: 1,
      expectedDraftRevisionId: draft.revisionId,
    });
    if (!published.ok) throw new Error("publish unexpectedly conflicted");
    expect(published.route).toBeUndefined();
    expect(await client.contentRoute.count({ where: { translationId: translation.id } })).toBe(0);
  });
});

test.describe("AC-0.4-02 - missing-translation fallback resolution", () => {
  test("CAP-3 resolving a locale with no native translation returns the entity's Turkish route as fallback", async ({
    testDatabase,
  }) => {
    const { client } = testDatabase;
    const entity = await createEntity(client, { contentType: SERVICE_FIXTURE_CONTENT_TYPE });
    const trTranslation = await createTranslation(client, { entityId: entity.id, locale: "tr" });
    await createTranslation(client, { entityId: entity.id, locale: "en" }); // never published

    const published = await publishTranslation(client, trTranslation.id, 0, "atik-denetimi");
    if (!published.ok) throw new Error("publish unexpectedly conflicted");

    const routes = await getPublishedRouteCandidates(client, entity.id);

    const enResolution = resolvePublicRoute(entity.id, "en", routes);
    expect(enResolution).toEqual({
      kind: "fallback",
      url: "/servisler/atik-denetimi",
      canonical: "/servisler/atik-denetimi",
      noindex: true,
    });
    // Never invented via string substitution (which would have produced
    // "/en/servisler/atik-denetimi").
    if (enResolution.kind === "fallback") {
      expect(enResolution.url).not.toContain("/en/");
    }

    const trResolution = resolvePublicRoute(entity.id, "tr", routes);
    expect(trResolution).toEqual({ kind: "native", url: "/servisler/atik-denetimi" });
  });

  test("CAP-3 an entity with no published route in any locale resolves to notFound, never a guessed target", async ({
    testDatabase,
  }) => {
    const { client } = testDatabase;
    const entity = await createEntity(client, { contentType: SERVICE_FIXTURE_CONTENT_TYPE });
    await createTranslation(client, { entityId: entity.id, locale: "tr" }); // never published

    const routes = await getPublishedRouteCandidates(client, entity.id);
    expect(resolvePublicRoute(entity.id, "en", routes)).toEqual({ kind: "notFound" });
  });

  test("CAP-3 a fallback resolution for one entity is never satisfied by a different entity's route, even from an unfiltered query", async ({
    testDatabase,
  }) => {
    const { client } = testDatabase;
    const entityA = await createEntity(client, { contentType: SERVICE_FIXTURE_CONTENT_TYPE });
    const entityB = await createEntity(client, { contentType: SERVICE_FIXTURE_CONTENT_TYPE });
    const translationA = await createTranslation(client, { entityId: entityA.id, locale: "tr" });
    await createTranslation(client, { entityId: entityB.id, locale: "tr" }); // never published

    const publishedA = await publishTranslation(client, translationA.id, 0, "atik-denetimi");
    if (!publishedA.ok) throw new Error("publish unexpectedly conflicted");

    // A caller's own query scoped correctly to entityB (which has no
    // published route) never sees entityA's row.
    const routesForB = await getPublishedRouteCandidates(client, entityB.id);
    expect(resolvePublicRoute(entityB.id, "en", routesForB)).toEqual({ kind: "notFound" });

    // Even an entirely *unscoped* read (every published route in the
    // database, including entityA's real one) must not leak entityA's
    // route when resolvePublicRoute is asked to resolve entityB - this is
    // resolvePublicRoute's own defensive entityId filter, not merely the
    // caller's query discipline.
    const allRoutes = await getPublishedRouteCandidates(client, entityA.id).then(async (a) => [
      ...a,
      ...(await getPublishedRouteCandidates(client, entityB.id)),
    ]);
    expect(resolvePublicRoute(entityB.id, "en", allRoutes)).toEqual({ kind: "notFound" });
    expect(resolvePublicRoute(entityA.id, "tr", allRoutes)).toEqual({
      kind: "native",
      url: "/servisler/atik-denetimi",
    });
  });
});

test.describe("AC-0.4-03 - collision and unsafe-input rejection at publish", () => {
  test("CAP-2 publishing a second translation with the same normalized route is rejected before its pointer swap, leaving the first translation's route/pointer untouched", async ({
    testDatabase,
  }) => {
    const { client } = testDatabase;
    const entityA = await createEntity(client, { contentType: SERVICE_FIXTURE_CONTENT_TYPE });
    const entityB = await createEntity(client, { contentType: SERVICE_FIXTURE_CONTENT_TYPE });
    const translationA = await createTranslation(client, { entityId: entityA.id, locale: "tr" });
    const translationB = await createTranslation(client, { entityId: entityB.id, locale: "tr" });

    const publishedA = await publishTranslation(client, translationA.id, 0, "atik-denetimi");
    if (!publishedA.ok) throw new Error("publish A unexpectedly conflicted");

    const draftB = await saveDraft(client, {
      translationId: translationB.id,
      expectedVersion: 0,
      schemaVersion: SERVICE_FIXTURE_SCHEMA_VERSION,
      payload: { title: "Danışmanlık 2", slug: "atik-denetimi", category: "Hizmet", order: 1 },
      createdBy: "test:story-0-4",
    });
    if (!draftB.ok) throw new Error("saveDraft B unexpectedly conflicted");

    const resultB = await publish(
      client,
      { translationId: translationB.id, expectedVersion: 1, expectedDraftRevisionId: draftB.revisionId },
      undefined,
      {
        candidate: {
          contentType: SERVICE_FIXTURE_CONTENT_TYPE,
          locale: "tr",
          collectionSegment: SEGMENTS.tr,
          slug: "atik-denetimi",
        },
      },
    );
    expect(resultB.ok).toBe(false);
    if (resultB.ok) throw new Error("expected a route conflict");
    if (!("routeConflict" in resultB)) throw new Error("expected a routeConflict, not a version conflict");
    expect(resultB.submittedRoute).toEqual({
      contentType: SERVICE_FIXTURE_CONTENT_TYPE,
      locale: "tr",
      collectionSegment: SEGMENTS.tr,
      slug: "atik-denetimi",
    });

    // B's own pointer/version never advanced - the whole publish rolled back.
    const unchangedB = await client.contentTranslation.findUniqueOrThrow({
      where: { id: translationB.id },
    });
    expect(unchangedB.publishedRevisionId).toBeNull();
    expect(unchangedB.version).toBe(1);
    expect(await client.contentRoute.count({ where: { translationId: translationB.id } })).toBe(0);

    // A's route is completely untouched.
    const routeA = await client.contentRoute.findUniqueOrThrow({
      where: { translationId: translationA.id },
    });
    expect(routeA.slug).toBe("atik-denetimi");
    expect(await client.contentRoute.count()).toBe(1);
  });

  test("CAP-2 two publishes racing for the same route concurrently: exactly one wins, the loser gets a safe routeConflict (unique-index P2002 mapped, never a raw Prisma error)", async ({
    testDatabase,
  }) => {
    const { client } = testDatabase;
    const entityA = await createEntity(client, { contentType: SERVICE_FIXTURE_CONTENT_TYPE });
    const entityB = await createEntity(client, { contentType: SERVICE_FIXTURE_CONTENT_TYPE });
    const translationA = await createTranslation(client, { entityId: entityA.id, locale: "tr" });
    const translationB = await createTranslation(client, { entityId: entityB.id, locale: "tr" });

    const draftA = await saveDraft(client, {
      translationId: translationA.id,
      expectedVersion: 0,
      schemaVersion: SERVICE_FIXTURE_SCHEMA_VERSION,
      payload: { title: "Danışmanlık A", slug: "yaris-slug", category: "Hizmet", order: 0 },
      createdBy: "test:story-0-4",
    });
    const draftB = await saveDraft(client, {
      translationId: translationB.id,
      expectedVersion: 0,
      schemaVersion: SERVICE_FIXTURE_SCHEMA_VERSION,
      payload: { title: "Danışmanlık B", slug: "yaris-slug", category: "Hizmet", order: 1 },
      createdBy: "test:story-0-4",
    });
    if (!draftA.ok || !draftB.ok) throw new Error("saveDraft unexpectedly conflicted");

    const candidate = () => ({
      candidate: {
        contentType: SERVICE_FIXTURE_CONTENT_TYPE,
        locale: "tr" as const,
        collectionSegment: SEGMENTS.tr,
        slug: "yaris-slug",
      },
    });

    // Both transactions' pre-check (`findFirst`) can observe "no collision"
    // before either commits - only the database's unique index actually
    // arbitrates. Race them concurrently to exercise that real path rather
    // than the sequential pre-check above.
    const [resultA, resultB] = await Promise.all([
      publish(
        client,
        { translationId: translationA.id, expectedVersion: 1, expectedDraftRevisionId: draftA.revisionId },
        undefined,
        candidate(),
      ),
      publish(
        client,
        { translationId: translationB.id, expectedVersion: 1, expectedDraftRevisionId: draftB.revisionId },
        undefined,
        candidate(),
      ),
    ]);

    const results = [resultA, resultB];
    const winners = results.filter((r) => r.ok);
    const losers = results.filter((r) => !r.ok);
    expect(winners).toHaveLength(1);
    expect(losers).toHaveLength(1);
    const loser = losers[0];
    if (loser.ok) throw new Error("unreachable");
    if (!("routeConflict" in loser)) throw new Error("expected a safe routeConflict, not a version conflict");
    expect(loser.submittedRoute.slug).toBe("yaris-slug");

    // Exactly one ContentRoute row for the contested slug exists - the
    // loser never created a partial/duplicate row.
    expect(
      await client.contentRoute.count({
        where: { contentType: SERVICE_FIXTURE_CONTENT_TYPE, locale: "tr", collectionSegment: SEGMENTS.tr, slug: "yaris-slug" },
      }),
    ).toBe(1);
  });

  test("CAP-2 a re-publish with a changed slug updates the existing ContentRoute row rather than creating a second one", async ({
    testDatabase,
  }) => {
    const { client } = testDatabase;
    const entity = await createEntity(client, { contentType: SERVICE_FIXTURE_CONTENT_TYPE });
    const translation = await createTranslation(client, { entityId: entity.id, locale: "tr" });

    const first = await publishTranslation(client, translation.id, 0, "eski-slug");
    if (!first.ok) throw new Error("first publish unexpectedly conflicted");
    expect(first.route?.url).toBe("/servisler/eski-slug");

    const second = await publishTranslation(client, translation.id, 2, "yeni-slug");
    if (!second.ok) throw new Error("second publish unexpectedly conflicted");
    expect(second.route?.url).toBe("/servisler/yeni-slug");

    expect(await client.contentRoute.count({ where: { translationId: translation.id } })).toBe(1);
    const row = await client.contentRoute.findUniqueOrThrow({ where: { translationId: translation.id } });
    expect(row.slug).toBe("yeni-slug");
  });

  test("CAP-2 publishing with an unsafe route candidate is rejected and creates no partial ContentRoute/pointer state", async ({
    testDatabase,
  }) => {
    const { client } = testDatabase;
    const entity = await createEntity(client, { contentType: SERVICE_FIXTURE_CONTENT_TYPE });
    const translation = await createTranslation(client, { entityId: entity.id, locale: "tr" });
    const draft = await saveDraft(client, {
      translationId: translation.id,
      expectedVersion: 0,
      schemaVersion: SERVICE_FIXTURE_SCHEMA_VERSION,
      payload: { title: "Danışmanlık", slug: "atik/denetimi", category: "Hizmet", order: 0 },
      createdBy: "test:story-0-4",
    });
    if (!draft.ok) throw new Error("saveDraft unexpectedly conflicted");

    let caught: unknown;
    try {
      await publish(
        client,
        { translationId: translation.id, expectedVersion: 1, expectedDraftRevisionId: draft.revisionId },
        undefined,
        {
          candidate: {
            contentType: SERVICE_FIXTURE_CONTENT_TYPE,
            locale: "tr",
            collectionSegment: SEGMENTS.tr,
            slug: "atik/denetimi",
          },
        },
      );
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ContentModelError);

    const unchanged = await client.contentTranslation.findUniqueOrThrow({ where: { id: translation.id } });
    expect(unchanged.publishedRevisionId).toBeNull();
    expect(unchanged.version).toBe(1);
    expect(await client.contentRoute.count({ where: { translationId: translation.id } })).toBe(0);
  });

  test("CAP-2 publishing with a route candidate whose locale does not match the translation being published is rejected, writing nothing", async ({
    testDatabase,
  }) => {
    const { client } = testDatabase;
    const entity = await createEntity(client, { contentType: SERVICE_FIXTURE_CONTENT_TYPE });
    // The translation being published is "tr", but the submitted route
    // candidate claims "en" - this must never be trusted at face value.
    const translation = await createTranslation(client, { entityId: entity.id, locale: "tr" });
    const draft = await saveDraft(client, {
      translationId: translation.id,
      expectedVersion: 0,
      schemaVersion: SERVICE_FIXTURE_SCHEMA_VERSION,
      payload: { title: "Danışmanlık", slug: "atik-denetimi", category: "Hizmet", order: 0 },
      createdBy: "test:story-0-4",
    });
    if (!draft.ok) throw new Error("saveDraft unexpectedly conflicted");

    let caught: unknown;
    try {
      await publish(
        client,
        { translationId: translation.id, expectedVersion: 1, expectedDraftRevisionId: draft.revisionId },
        undefined,
        {
          candidate: {
            contentType: SERVICE_FIXTURE_CONTENT_TYPE,
            locale: "en",
            collectionSegment: SEGMENTS.en,
            slug: "waste-audit",
          },
        },
      );
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ContentModelError);

    const unchanged = await client.contentTranslation.findUniqueOrThrow({ where: { id: translation.id } });
    expect(unchanged.publishedRevisionId).toBeNull();
    expect(unchanged.version).toBe(1);
    expect(await client.contentRoute.count({ where: { translationId: translation.id } })).toBe(0);
  });
});

test.describe("AC-0.4-04 - full generation across Turkish and Global English", () => {
  test("CAP-1/CAP-2 a Service entity published in both locales produces exact canonical URLs", async ({
    testDatabase,
  }) => {
    const { client } = testDatabase;
    const entity = await createEntity(client, { contentType: SERVICE_FIXTURE_CONTENT_TYPE });

    const locales: ReadonlyArray<{ locale: "tr" | "en"; slug: string; segment: string }> = [
      { locale: "tr", slug: "atik-denetimi", segment: SEGMENTS.tr },
      { locale: "en", slug: "waste-audit", segment: SEGMENTS.en },
    ];

    for (const { locale, slug, segment } of locales) {
      const translation = await createTranslation(client, { entityId: entity.id, locale });
      const draft = await saveDraft(client, {
        translationId: translation.id,
        expectedVersion: 0,
        schemaVersion: SERVICE_FIXTURE_SCHEMA_VERSION,
        payload: { title: "Danışmanlık", slug, category: "Hizmet", order: 0 },
        createdBy: "test:story-0-4",
      });
      if (!draft.ok) throw new Error(`saveDraft unexpectedly conflicted for ${locale}`);
      const published = await publish(
        client,
        { translationId: translation.id, expectedVersion: 1, expectedDraftRevisionId: draft.revisionId },
        undefined,
        { candidate: { contentType: SERVICE_FIXTURE_CONTENT_TYPE, locale, collectionSegment: segment, slug } },
      );
      if (!published.ok) throw new Error(`publish unexpectedly conflicted for ${locale}`);
    }

    const routes: readonly PublishedRoute[] = await getPublishedRouteCandidates(client, entity.id);
    expect(routes).toHaveLength(2);

    function routeFor(locale: "tr" | "en"): RouteCandidate {
      const found = routes.find((route) => route.locale === locale);
      if (!found) throw new Error(`expected a ContentRoute row for locale ${locale}`);
      return found;
    }

    expect(generateRoute(routeFor("tr"))).toBe("/servisler/atik-denetimi");
    expect(generateRoute(routeFor("en"))).toBe("/en/services/waste-audit");
  });
});
