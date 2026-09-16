import { randomUUID } from "node:crypto";
import { expect, test } from "../support/merged-fixtures";
import type { Prisma, PrismaClient } from "@prisma/client";
import { createEntity, createTranslation } from "../../lib/content-model/model";
import { validatePayload } from "../../lib/content-model/payload-validation";
import { ContentModelError } from "../../lib/content-model/errors";
import { issueTestAdminContext } from "../../lib/content-model/admin-context-test-support";
import type { AdminContext } from "../../lib/content-model/admin-context";
import { adminPublish, adminSaveDraft } from "../../lib/content-model/admin-content-store";
import { publish } from "../../lib/content-model/publishing";
import { importTranslationsAtomically } from "../../lib/content-model/translation-export-import";
import type { RouteCandidate } from "../../lib/content-model/route-registry";
import type { OutboxEvent } from "../../lib/content-model/outbox-recorder";

test.setTimeout(120_000);

const SERVICE_CONTENT_TYPE = "service";
const SERVICE_SCHEMA_VERSION = 2;

type ServiceTextBlock = Readonly<{ id: string; type: "text"; html: string }>;

type ServicePayload = Readonly<{
  title: string;
  slug: string;
  summary: string;
  blocks: readonly ServiceTextBlock[];
  icon: string | null;
  imageAssetId: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
}>;

type ServiceRoutesModule = Readonly<{
  SERVICE_COLLECTION_SEGMENTS: Readonly<Record<"tr" | "en", string>>;
  serviceRouteCandidate(locale: "tr" | "en", slug: string): RouteCandidate;
}>;

type ServiceRouteLookupModule = Readonly<{
  findPublishedEntityByRoute(
    client: PrismaClient,
    locale: "tr" | "en",
    collectionSegment: string,
    slug: string,
  ): Promise<Readonly<{ entityId: string }> | null>;
}>;

async function loadFutureModule<T>(name: string): Promise<T> {
  const modulePath = `../../lib/content-model/${name}`;
  return import(modulePath) as Promise<T>;
}

function servicePayload(slug: string, overrides: Partial<ServicePayload> = {}): ServicePayload {
  return {
    title: "Industrial Waste Audit",
    slug,
    summary: "A concise locale-owned service summary.",
    blocks: [{ id: "b1", type: "text", html: "A complete locale-owned service body." }],
    icon: "recycle",
    imageAssetId: null,
    seoTitle: "Industrial Waste Audit | Metro",
    seoDescription: "Independent industrial waste audit services.",
    ...overrides,
  };
}

async function issueActor(
  client: PrismaClient,
  label: string,
): Promise<AdminContext> {
  const user = await client.adminUser.create({
    data: {
      email: `${label}-${randomUUID()}@example.test`,
      passwordHash: "unused-in-story-3-1-contract-tests",
      name: "Story 3.1 Contract Actor",
    },
  });
  return issueTestAdminContext({ id: user.id, email: user.email });
}

async function saveServiceDraft(
  client: PrismaClient,
  actor: AdminContext,
  translationId: string,
  expectedVersion: number,
  payload: ServicePayload,
) {
  const result = await adminSaveDraft(client, actor, {
    translationId,
    expectedVersion,
    schemaVersion: SERVICE_SCHEMA_VERSION,
    payload: payload as Prisma.InputJsonValue,
  });
  if (!result.ok) throw new Error("service draft unexpectedly conflicted");
  return result;
}

async function expectInvalidServicePayload(payload: unknown, schemaVersion = SERVICE_SCHEMA_VERSION) {
  let caught: unknown;
  try {
    validatePayload(SERVICE_CONTENT_TYPE, schemaVersion, payload);
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(ContentModelError);
  if (!(caught instanceof ContentModelError)) throw new Error("expected ContentModelError");
  expect(caught.classification).toBe("invalidInput");
}

test.describe("AC-3.1-10 - real Service payload schema", () => {
  test("accepts the exact real ServicePayload and returns a detached canonical value", async () => {
    const input = servicePayload("industrial-waste-audit");
    const actual = validatePayload(
      SERVICE_CONTENT_TYPE,
      SERVICE_SCHEMA_VERSION,
      input,
    ) as unknown as ServicePayload;

    expect(actual).toEqual(input);
    expect(actual).not.toBe(input);
    expect(Object.keys(actual).sort()).toEqual([
      "blocks",
      "icon",
      "imageAssetId",
      "seoDescription",
      "seoTitle",
      "slug",
      "summary",
      "title",
    ]);
  });

  test("rejects every missing or blank required Service field as classified invalid input", async () => {
    const valid = servicePayload("required-fields");
    const invalidPayloads: unknown[] = [
      { ...valid, title: "" },
      { ...valid, slug: "   " },
      { ...valid, summary: "\n" },
      { ...valid, blocks: [] },
      (({ title: _title, ...rest }) => rest)(valid),
      (({ slug: _slug, ...rest }) => rest)(valid),
      (({ summary: _summary, ...rest }) => rest)(valid),
      (({ blocks: _blocks, ...rest }) => rest)(valid),
    ];

    for (const payload of invalidPayloads) await expectInvalidServicePayload(payload);
  });

  test("rejects unknown keys, invalid nullable fields, and unsupported Service schema versions", async () => {
    const valid = servicePayload("closed-shape");
    await expectInvalidServicePayload({ ...valid, category: "legacy-fixture-field" });
    await expectInvalidServicePayload({ ...valid, icon: 42 });
    await expectInvalidServicePayload({ ...valid, seoDescription: false });
    await expectInvalidServicePayload(valid, SERVICE_SCHEMA_VERSION + 1);
  });
});

test.describe("AC-3.1-02 and AC-3.1-03 - locale-aware admin draft/publish contract", () => {
  test("editing and publishing tr leaves the en locale missing and commits immutable revision, pointer, and audit state", async ({ testDatabase }) => {
    const { client } = testDatabase;
    const actor = await issueActor(client, "locale-isolation");
    const entity = await createEntity(client, { contentType: SERVICE_CONTENT_TYPE });
    const tr = await createTranslation(client, { entityId: entity.id, locale: "tr" });

    const draft = await saveServiceDraft(
      client,
      actor,
      tr.id,
      tr.version,
      servicePayload("atik-denetimi", { title: "Atık Denetimi" }),
    );
    const published = await adminPublish(client, actor, {
      translationId: tr.id,
      expectedVersion: draft.translation.version,
      expectedDraftRevisionId: draft.revisionId,
    });

    expect(published.ok).toBe(true);
    if (!published.ok) throw new Error("service publish unexpectedly conflicted");
    expect(published.translation.draftRevisionId).toBe(draft.revisionId);
    expect(published.translation.publishedRevisionId).toBe(draft.revisionId);
    expect(await client.contentTranslation.count({ where: { entityId: entity.id } })).toBe(1);
    expect(await client.contentTranslation.findUnique({
      where: { entityId_locale: { entityId: entity.id, locale: "en" } },
    })).toBeNull();
    expect(await client.contentTranslationRevision.count({ where: { translationId: tr.id } })).toBe(1);
    expect(await client.auditLog.count({
      where: { entityId: tr.id, action: { in: ["content.draft.save", "content.publish"] } },
    })).toBe(2);
  });

  test("a stale locale edit returns the safe conflict and creates no extra revision or audit row", async ({ testDatabase }) => {
    const { client } = testDatabase;
    const actor = await issueActor(client, "stale-service");
    const entity = await createEntity(client, { contentType: SERVICE_CONTENT_TYPE });
    const translation = await createTranslation(client, { entityId: entity.id, locale: "en" });
    const first = await saveServiceDraft(
      client,
      actor,
      translation.id,
      0,
      servicePayload("waste-audit"),
    );

    const stalePayload = servicePayload("stale-waste-audit", { title: "Stale edit" });
    const conflict = await adminSaveDraft(client, actor, {
      translationId: translation.id,
      expectedVersion: 0,
      schemaVersion: SERVICE_SCHEMA_VERSION,
      payload: stalePayload as Prisma.InputJsonValue,
    });

    expect(conflict.ok).toBe(false);
    if (conflict.ok) throw new Error("stale service draft unexpectedly succeeded");
    expect(conflict.conflict).toBe(true);
    expect(conflict.current.version).toBe(first.translation.version);
    expect(conflict.submitted.payload).toEqual(stalePayload);
    expect(await client.contentTranslationRevision.count({ where: { translationId: translation.id } })).toBe(1);
    expect(await client.auditLog.count({ where: { entityId: translation.id, action: "content.draft.save" } })).toBe(1);
  });

  test("a normalized route collision rejects the losing locale publish without a pointer or outbox side effect", async ({ testDatabase }) => {
    const { client } = testDatabase;
    const actor = await issueActor(client, "route-collision");
    const entityA = await createEntity(client, { contentType: SERVICE_CONTENT_TYPE });
    const entityB = await createEntity(client, { contentType: SERVICE_CONTENT_TYPE });
    const translationA = await createTranslation(client, { entityId: entityA.id, locale: "tr" });
    const translationB = await createTranslation(client, { entityId: entityB.id, locale: "tr" });
    const draftA = await saveServiceDraft(client, actor, translationA.id, 0, servicePayload("ATIK-DENETIMI"));
    const draftB = await saveServiceDraft(client, actor, translationB.id, 0, servicePayload("atik-denetimi"));
    const { serviceRouteCandidate } = await loadFutureModule<ServiceRoutesModule>("service-routes");
    const persistOutbox = {
      recorder: async (tx: Parameters<NonNullable<Parameters<typeof publish>[4]>["recorder"]>[0], event: OutboxEvent) => {
        await tx.invalidationOutboxEvent.create({
          data: {
            sourceEntityId: event.sourceEntityId,
            sourceTranslationId: event.sourceTranslationId,
            locale: event.locale,
            tags: [...event.tags],
          },
        });
      },
      tags: ["content:service", "service:collection"],
    };

    const winner = await publish(
      client,
      { translationId: translationA.id, expectedVersion: 1, expectedDraftRevisionId: draftA.revisionId },
      undefined,
      { candidate: serviceRouteCandidate("tr", "ATIK-DENETIMI") },
      persistOutbox,
    );
    if (!winner.ok) throw new Error("first route publish unexpectedly failed");
    const loser = await publish(
      client,
      { translationId: translationB.id, expectedVersion: 1, expectedDraftRevisionId: draftB.revisionId },
      undefined,
      { candidate: serviceRouteCandidate("tr", "atik-denetimi") },
      persistOutbox,
    );

    expect(loser.ok).toBe(false);
    if (loser.ok) throw new Error("colliding service route unexpectedly published");
    expect("routeConflict" in loser && loser.routeConflict).toBe(true);
    expect((await client.contentTranslation.findUniqueOrThrow({ where: { id: translationB.id } })).publishedRevisionId).toBeNull();
    expect(await client.contentRoute.count({ where: { contentType: SERVICE_CONTENT_TYPE } })).toBe(1);
    expect(await client.invalidationOutboxEvent.count()).toBe(1);
  });

  test("an outbox failure rolls the service pointer, audit row, and native route reservation back atomically", async ({ testDatabase }) => {
    const { client } = testDatabase;
    const actor = await issueActor(client, "atomic-service-publish");
    const entity = await createEntity(client, { contentType: SERVICE_CONTENT_TYPE });
    const translation = await createTranslation(client, { entityId: entity.id, locale: "en" });
    const draft = await saveServiceDraft(
      client,
      actor,
      translation.id,
      0,
      servicePayload("environmental-audit", { title: "Environmental Audit" }),
    );
    const { serviceRouteCandidate } = await loadFutureModule<ServiceRoutesModule>("service-routes");

    await expect(publish(
      client,
      { translationId: translation.id, expectedVersion: 1, expectedDraftRevisionId: draft.revisionId },
      async (tx, event) => {
        await tx.auditLog.create({
          data: {
            action: event.action,
            entity: event.entity,
            entityId: event.entityId,
            userId: actor.actorId,
            metadata: event.metadata,
          },
        });
      },
      { candidate: serviceRouteCandidate("en", "environmental-audit") },
      {
        tags: [`content:${entity.id}`, `content:${entity.id}:en`, "service:collection"],
        recorder: async () => { throw new Error("forced service outbox failure"); },
      },
    )).rejects.toMatchObject({ classification: "internal" });

    const reloaded = await client.contentTranslation.findUniqueOrThrow({ where: { id: translation.id } });
    expect(reloaded.publishedRevisionId).toBeNull();
    expect(reloaded.version).toBe(1);
    expect(await client.auditLog.count({ where: { entityId: translation.id, action: "content.publish" } })).toBe(0);
    expect(await client.contentRoute.count({ where: { translationId: translation.id } })).toBe(0);
    expect(await client.invalidationOutboxEvent.count()).toBe(0);
  });
});

test.describe("AC-3.1-05 - native route generation and reverse lookup", () => {
  test("canonical locale segments and reverse lookup return only a published entity", async ({ testDatabase }) => {
    const { client } = testDatabase;
    const actor = await issueActor(client, "global-route");
    const entity = await createEntity(client, { contentType: SERVICE_CONTENT_TYPE });
    const translation = await createTranslation(client, { entityId: entity.id, locale: "en" });
    const draft = await saveServiceDraft(
      client,
      actor,
      translation.id,
      0,
      servicePayload("waste-audit", { title: "Waste Audit" }),
    );
    const routes = await loadFutureModule<ServiceRoutesModule>("service-routes");
    const lookup = await loadFutureModule<ServiceRouteLookupModule>("service-route-lookup");

    expect(routes.SERVICE_COLLECTION_SEGMENTS).toEqual({
      tr: "servisler",
      en: "services",
    });
    const candidate = routes.serviceRouteCandidate("en", "waste-audit");
    const published = await publish(
      client,
      { translationId: translation.id, expectedVersion: 1, expectedDraftRevisionId: draft.revisionId },
      undefined,
      { candidate },
    );
    if (!published.ok) throw new Error("Global service publish unexpectedly failed");

    await expect(lookup.findPublishedEntityByRoute(
      client,
      "en",
      routes.SERVICE_COLLECTION_SEGMENTS.en,
      "waste-audit",
    )).resolves.toEqual({ entityId: entity.id });
    await expect(lookup.findPublishedEntityByRoute(
      client,
      "en",
      routes.SERVICE_COLLECTION_SEGMENTS.en,
      "unknown-service",
    )).resolves.toBeNull();

    await client.contentTranslation.update({
      where: { id: translation.id },
      data: { publishedRevisionId: null },
    });
    await expect(lookup.findPublishedEntityByRoute(
      client,
      "en",
      routes.SERVICE_COLLECTION_SEGMENTS.en,
      "waste-audit",
    )).resolves.toBeNull();
  });
});

test.describe("translation import schema contract", () => {
  test("imports and publishes a current v2 Service payload", async ({ testDatabase }) => {
    const { client } = testDatabase;
    const actor = await issueActor(client, "translation-v2");
    const entity = await createEntity(client, { contentType: SERVICE_CONTENT_TYPE });
    const tr = await createTranslation(client, { entityId: entity.id, locale: "tr" });
    await saveServiceDraft(
      client,
      actor,
      tr.id,
      tr.version,
      servicePayload("translated-service"),
    );
    const english = servicePayload("ignored-by-import", {
      title: "Translated service",
      summary: "English summary.",
    });

    await importTranslationsAtomically(client, {
      entityId: entity.id,
      translations: { en: english },
      adminContext: actor,
    });

    const imported = await client.contentTranslation.findUniqueOrThrow({
      where: { entityId_locale: { entityId: entity.id, locale: "en" } },
      include: { publishedRevision: true, route: true },
    });
    expect(imported.publishedRevision?.schemaVersion).toBe(SERVICE_SCHEMA_VERSION);
    expect(imported.publishedRevision?.payload).toMatchObject({
      title: "Translated service",
      slug: "translated-service",
      summary: "English summary.",
    });
    expect(imported.route?.slug).toBe("translated-service");
  });
});
