import { randomUUID } from "node:crypto";
import { expect, test } from "../support/merged-fixtures";
import type { Prisma, PrismaClient } from "@prisma/client";
import { createEntity, createTranslation } from "../../lib/content-model/model";
import { issueTestAdminContext } from "../../lib/content-model/admin-context-test-support";
import type { AdminContext } from "../../lib/content-model/admin-context";
import { adminPublish, adminSaveDraft } from "../../lib/content-model/admin-content-store";
import type { RouteCandidate } from "../../lib/content-model/route-registry";
import { getPublishedRouteCandidates } from "../../lib/content-model/route-reader";
import { persistedOutboxRecorder } from "../../lib/content-model/outbox-store";
import { contentAvailabilityTag, contentEntityTag } from "../../lib/content-model/cache-tags";
import {
  ensureSiteSettingsEntity,
  getSiteSettingsEntityId,
} from "../../lib/content-model/site-settings-registry";
import {
  SITE_SETTINGS_SCHEMA_VERSION,
  type SiteSettingsPayload,
} from "../../lib/content-model/site-settings-schema";
import { PersistedMappingPort } from "../../lib/content-model/persisted-mapping-port";
import { resolveLegacyOrUnknownAddress } from "../../lib/content-model/public-route-resolution";

test.setTimeout(120_000);

const SERVICE_CONTENT_TYPE = "service";
const SERVICE_SCHEMA_VERSION = 2;
const SERVICE_COLLECTION_SEGMENTS: Readonly<Record<"tr" | "en", string>> = {
  tr: "servisler",
  en: "services",
};

/**
 * Red-phase scaffold for the not-yet-built Story 6.2 read companions -
 * mirrors `story-3-1-service-contract.spec.ts`'s `loadFutureModule` pattern
 * (a computed template-string `import()` specifier types as `any`, so this
 * file compiles today and only fails at runtime until the real modules
 * exist).
 */
async function loadFutureModule<T>(name: string): Promise<T> {
  const modulePath = `../../lib/content-model/${name}`;
  return import(modulePath) as Promise<T>;
}


type SiteSeoDefaults = Readonly<{
  siteName: string;
  defaultDescription: string;
  defaultOgImageUrl: string | null;
}>;

type SiteSettingsModule = Readonly<{
  getSiteSeoDefaults(client: PrismaClient, requestedLocale: "tr" | "en"): Promise<SiteSeoDefaults>;
}>;

type PublishedRoute = Readonly<{
  contentType: string;
  locale: "tr" | "en";
  collectionSegment: string;
  slug: string;
  entityId: string;
}>;

type RouteReaderSeoModule = Readonly<{
  getAllPublishedRoutesForSitemap(
    client: PrismaClient,
    contentType: string,
  ): Promise<ReadonlyArray<Readonly<{ route: PublishedRoute; publishedAt: Date }>>>;
}>;

type CacheTagsSeoModule = Readonly<{ seoIndexTag(): string }>;

type PublicSeoRedirectModule = Readonly<{
  recordFallbackToNativeRedirect(
    client: PrismaClient,
    input: Readonly<{
      entityId: string;
      locale: "tr" | "en";
      collectionSegment: string;
      turkishSlug: string | null;
      newNativeSlug: string;
      targetTranslationId: string;
      targetRevisionId: string;
    }>,
  ): Promise<void>;
}>;

function servicePayload(slug: string, overrides: Partial<Record<string, unknown>> = {}) {
  return {
    title: "Industrial Waste Audit",
    slug,
    summary: "We audit industrial waste streams end to end.",
    blocks: [{ id: "b1", type: "text", html: "We audit industrial waste streams end to end." }],
    icon: null,
    imageAssetId: null,
    seoTitle: null,
    seoDescription: null,
    ...overrides,
  };
}

function siteSettingsPayload(overrides: Partial<SiteSettingsPayload> = {}): SiteSettingsPayload {
  return {
    brand: { name: "Metro", logoAssetId: null },
    contact: { email: "info@example.com", phone: "+90 555 000", address: "İstanbul" },
    cta: { label: "Teklif al", url: "/contact" },
    navigation: [],
    footer: { summary: "Metro footer summary.", columns: [] },
    mission: "Metro mission statement used as the default SEO description.",
    vision: "Our vision statement.",
    termsBody: "<p>Terms body.</p>",
    privacyBody: "<p>Privacy body.</p>",
    ...overrides,
  };
}

async function issueActor(client: PrismaClient, label: string): Promise<AdminContext> {
  const user = await client.adminUser.create({
    data: {
      email: `${label}-${randomUUID()}@example.test`,
      passwordHash: "unused-in-story-6-2-contract-tests",
      name: "Story 6.2 Contract Actor",
    },
  });
  return issueTestAdminContext({ id: user.id, email: user.email });
}

async function publishService(
  client: PrismaClient,
  actor: AdminContext,
  entityId: string,
  locale: "tr" | "en",
  slug: string,
  extraTags: readonly string[],
) {
  const translation = await createTranslation(client, { entityId, locale });
  const draft = await adminSaveDraft(client, actor, {
    translationId: translation.id,
    expectedVersion: 0,
    schemaVersion: SERVICE_SCHEMA_VERSION,
    payload: servicePayload(slug) as unknown as Prisma.InputJsonValue,
  });
  if (!draft.ok) throw new Error("service draft unexpectedly conflicted");

  const candidate: RouteCandidate = {
    contentType: SERVICE_CONTENT_TYPE,
    locale,
    collectionSegment: SERVICE_COLLECTION_SEGMENTS[locale],
    slug,
  };
  const result = await adminPublish(
    client,
    actor,
    { translationId: translation.id, expectedVersion: draft.translation.version, expectedDraftRevisionId: draft.revisionId },
    { candidate },
    { recorder: persistedOutboxRecorder, tags: [contentEntityTag(entityId), contentAvailabilityTag(entityId, locale), ...extraTags] },
  );
  if (!result.ok) throw new Error("service publish unexpectedly failed");
  return { translation, result };
}

test.describe("CAP-1 upstream - getSiteSeoDefaults derives from the real published SiteSettingsPayload", () => {
  test("brand.name becomes siteName, mission becomes defaultDescription, non-fallback logo becomes defaultOgImageUrl", async ({ testDatabase }) => {
    const { client } = testDatabase;
    const { getSiteSeoDefaults } = await loadFutureModule<SiteSettingsModule>("site-seo-defaults");

    const { entityId } = await ensureSiteSettingsEntity(client);
    const actor = await issueActor(client, "seo-defaults");
    const existingId = await getSiteSettingsEntityId(client);
    expect(existingId).toBe(entityId);

    const translation = await client.contentTranslation.findFirstOrThrow({ where: { entityId, locale: "tr" } });
    const draft = await adminSaveDraft(client, actor, {
      translationId: translation.id,
      expectedVersion: 0,
      schemaVersion: SITE_SETTINGS_SCHEMA_VERSION,
      payload: siteSettingsPayload() as unknown as Prisma.InputJsonValue,
    });
    if (!draft.ok) throw new Error("site-settings draft unexpectedly conflicted");
    const published = await adminPublish(
      client,
      actor,
      { translationId: translation.id, expectedVersion: draft.translation.version, expectedDraftRevisionId: draft.revisionId },
      undefined,
      { recorder: persistedOutboxRecorder, tags: [contentEntityTag(entityId)] },
    );
    if (!published.ok) throw new Error("site-settings publish unexpectedly failed");

    const defaults = await getSiteSeoDefaults(client, "tr");
    expect(defaults.siteName).toBe("Metro");
    expect(defaults.defaultDescription).toBe("Metro mission statement used as the default SEO description.");
    expect(defaults.defaultOgImageUrl).toBeNull(); // no logoAssetId set in this fixture
  });

  test("with no published site-settings row, siteName falls back to the exact SiteHeader.tsx default literal, never throws", async ({ testDatabase }) => {
    const { client } = testDatabase;
    const { getSiteSeoDefaults } = await loadFutureModule<SiteSettingsModule>("site-seo-defaults");

    const defaults = await getSiteSeoDefaults(client, "tr");
    expect(defaults.siteName).toBe("Metro Yazılım");
    expect(defaults.defaultOgImageUrl).toBeNull();
  });
});

test.describe("CAP-2 upstream - getAllPublishedRoutesForSitemap only returns real published routes, joined to publishedAt", () => {
  test("returns one row per published ContentRoute with a real publishedAt, excludes an entity with no published route at all", async ({ testDatabase }) => {
    const { client } = testDatabase;
    const { getAllPublishedRoutesForSitemap } = await loadFutureModule<RouteReaderSeoModule>("route-reader");

    const published = await createEntity(client, { contentType: SERVICE_CONTENT_TYPE });
    const actor = await issueActor(client, "sitemap-rows");
    await publishService(client, actor, published.id, "tr", "atik-denetimi-sitemap", ["service:collection"]);

    // A second entity that never publishes - must never appear.
    await createEntity(client, { contentType: SERVICE_CONTENT_TYPE });

    const rows = await getAllPublishedRoutesForSitemap(client, SERVICE_CONTENT_TYPE);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.route.entityId).toBe(published.id);
    expect(rows[0]!.route.slug).toBe("atik-denetimi-sitemap");
    expect(rows[0]!.publishedAt).toBeInstanceOf(Date);
  });
});

test.describe("AC-6.2-06 - SEO invalidation tag composed on publish", () => {
  test("seoIndexTag() appears in the InvalidationOutboxEvent.tags row for a real service publish", async ({ testDatabase }) => {
    const { client } = testDatabase;
    const { seoIndexTag } = await loadFutureModule<CacheTagsSeoModule>("cache-tags");

    const entity = await createEntity(client, { contentType: SERVICE_CONTENT_TYPE });
    const actor = await issueActor(client, "outbox-tag");
    await publishService(client, actor, entity.id, "tr", "atik-denetimi-outbox", ["service:collection", seoIndexTag()]);

    const events = await client.invalidationOutboxEvent.findMany({ where: { sourceEntityId: entity.id } });
    expect(events).toHaveLength(1);
    expect(events[0]!.tags).toContain(seoIndexTag());
    expect(events[0]!.tags).toContain("service:collection");
  });
});

test.describe("AC-6.2-04 - native-publish-after-fallback redirect", () => {
  test("recordFallbackToNativeRedirect writes a LegacyMigrationMap row only when the alias address differs from the new native slug, and resolveLegacyOrUnknownAddress resolves it to a redirect", async ({ testDatabase }) => {
    const { client } = testDatabase;
    const { recordFallbackToNativeRedirect } = await loadFutureModule<PublicSeoRedirectModule>("public-seo-redirect");

    const entity = await createEntity(client, { contentType: SERVICE_CONTENT_TYPE });
    const actor = await issueActor(client, "fallback-redirect");

    // Only Turkish publishes first; Global requests are served via fallback.
    await publishService(client, actor, entity.id, "tr", "atik-denetimi", ["service:collection"]);

    const routesBeforeGlobal = await getPublishedRouteCandidates(client, entity.id);
    expect(routesBeforeGlobal.some((route) => route.locale === "en")).toBe(false);

    // Global then publishes under its native slug. The previously served
    // fallback alias must redirect to that published Global route.
    const { translation, result } = await publishService(client, actor, entity.id, "en", "waste-audit", ["service:collection"]);
    if (!result.ok) throw new Error("unreachable - checked above");

    await recordFallbackToNativeRedirect(client, {
      entityId: entity.id,
      locale: "en",
      collectionSegment: SERVICE_COLLECTION_SEGMENTS.en,
      turkishSlug: "atik-denetimi",
      newNativeSlug: "waste-audit",
      targetTranslationId: translation.id,
      targetRevisionId: result.ok ? result.translation.publishedRevisionId! : "",
    });

    const port = new PersistedMappingPort(client);
    const mapping = await port.lookupMapping("seo-fallback-redirect-v1", "route-alias", `${SERVICE_COLLECTION_SEGMENTS.en}/atik-denetimi`);
    expect(mapping).not.toBeNull();
    expect(mapping!.targetEntityId).toBe(entity.id);

    const routesAfter = await getPublishedRouteCandidates(client, entity.id);
    const legacyResolution = resolveLegacyOrUnknownAddress(
      mapping ? { targetEntityId: mapping.targetEntityId } : null,
      routesAfter,
      "en",
      null,
    );
    expect(legacyResolution.kind).toBe("redirect");
    if (legacyResolution.kind === "redirect") {
      expect(legacyResolution.url).toContain("waste-audit");
    }
  });

  test("recordFallbackToNativeRedirect is a no-op when the native slug matches the previously-served alias slug", async ({ testDatabase }) => {
    const { client } = testDatabase;
    const { recordFallbackToNativeRedirect } = await loadFutureModule<PublicSeoRedirectModule>("public-seo-redirect");

    const entity = await createEntity(client, { contentType: SERVICE_CONTENT_TYPE });
    const actor = await issueActor(client, "fallback-redirect-noop");
    await publishService(client, actor, entity.id, "tr", "ayni-slug", ["service:collection"]);
    const { translation, result } = await publishService(client, actor, entity.id, "en", "ayni-slug", ["service:collection"]);
    if (!result.ok) throw new Error("unreachable");

    await recordFallbackToNativeRedirect(client, {
      entityId: entity.id,
      locale: "en",
      collectionSegment: SERVICE_COLLECTION_SEGMENTS.en,
      turkishSlug: "ayni-slug",
      newNativeSlug: "ayni-slug",
      targetTranslationId: translation.id,
      targetRevisionId: result.ok ? result.translation.publishedRevisionId! : "",
    });

    const port = new PersistedMappingPort(client);
    const mapping = await port.lookupMapping("seo-fallback-redirect-v1", "route-alias", `${SERVICE_COLLECTION_SEGMENTS.en}/ayni-slug`);
    expect(mapping).toBeNull();
  });
});
