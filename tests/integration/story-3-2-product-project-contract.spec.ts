import { randomUUID } from "node:crypto";
import { expect, test } from "../support/merged-fixtures";
import type { Prisma } from "@prisma/client";
import { createEntity, createTranslation } from "../../lib/content-model/model";
import { issueTestAdminContext } from "../../lib/content-model/admin-context-test-support";
import type { AdminContext } from "../../lib/content-model/admin-context";
import { adminPublish, adminSaveDraft } from "../../lib/content-model/admin-content-store";
import { PRODUCT_CONTENT_TYPE, PRODUCT_SCHEMA_VERSION, PROJECT_CONTENT_TYPE, PROJECT_SCHEMA_VERSION, type ProductPayload, type ProjectPayload } from "../../lib/content-model/payload-validation";
import { productRouteCandidate } from "../../lib/content-model/product-routes";
import { projectRouteCandidate } from "../../lib/content-model/project-routes";
import { findPublishedProductByRoute } from "../../lib/content-model/product-route-lookup";
import { findPublishedProjectByRoute } from "../../lib/content-model/project-route-lookup";

test.setTimeout(120_000);

function productPayload(slug: string, overrides: Partial<ProductPayload> = {}): ProductPayload {
  return {
    title: "Cloud Security Suite",
    slug,
    summary: "A concise locale-owned product summary.",
    blocks: [{ id: "product-body", type: "text", html: "<p>A complete locale-owned product body.</p>" }],
    imageAssetId: null,
    galleryAssetIds: [],
    badge: "Yeni",
    priceLabel: "Talep üzerine",
    ctaUrl: "/iletisim",
    seoTitle: null,
    seoDescription: null,
    ...overrides,
  };
}

function projectPayload(slug: string, overrides: Partial<ProjectPayload> = {}): ProjectPayload {
  return {
    title: "Data Center Modernization",
    slug,
    category: "Infrastructure",
    coverImageAssetId: null,
    galleryAssetIds: [],
    challengeBlocks: [{ id: "project-challenge", type: "text", html: "<p>The challenge.</p>" }],
    solutionBlocks: [{ id: "project-solution", type: "text", html: "<p>The solution.</p>" }],
    client: "Acme Corp",
    seoTitle: null,
    seoDescription: null,
    ...overrides,
  };
}

async function issueActor(client: Parameters<typeof createEntity>[0], label: string): Promise<AdminContext> {
  const user = await client.adminUser.create({
    data: { email: `${label}-${randomUUID()}@example.test`, passwordHash: "unused", name: "Story 3.2 Actor" },
  });
  return issueTestAdminContext({ id: user.id, email: user.email });
}

test.describe("AC-3.2 - locale-aware Product draft/publish/route contract", () => {
  test("saves an isolated tr draft, publishes it, and reserves its native route", async ({ testDatabase }) => {
    const { client } = testDatabase;
    const actor = await issueActor(client, "product-basic");
    const entity = await createEntity(client, { contentType: PRODUCT_CONTENT_TYPE });
    const tr = await createTranslation(client, { entityId: entity.id, locale: "tr" });

    const draft = await adminSaveDraft(client, actor, {
      translationId: tr.id,
      expectedVersion: tr.version,
      schemaVersion: PRODUCT_SCHEMA_VERSION,
      payload: productPayload("bulut-guvenlik-paketi") as unknown as Prisma.InputJsonValue,
    });
    if (!draft.ok) throw new Error("product draft unexpectedly conflicted");

    const published = await adminPublish(
      client,
      actor,
      { translationId: tr.id, expectedVersion: draft.translation.version, expectedDraftRevisionId: draft.revisionId },
      { candidate: productRouteCandidate("tr", "bulut-guvenlik-paketi") },
    );
    expect(published.ok).toBe(true);

    await expect(
      findPublishedProductByRoute(client, "tr", "urunler", "bulut-guvenlik-paketi"),
    ).resolves.toEqual({ entityId: entity.id });
  });

  test("a stale expectedVersion returns a safe conflict and creates no extra revision", async ({ testDatabase }) => {
    const { client } = testDatabase;
    const actor = await issueActor(client, "product-conflict");
    const entity = await createEntity(client, { contentType: PRODUCT_CONTENT_TYPE });
    const translation = await createTranslation(client, { entityId: entity.id, locale: "en" });

    const first = await adminSaveDraft(client, actor, {
      translationId: translation.id,
      expectedVersion: 0,
      schemaVersion: PRODUCT_SCHEMA_VERSION,
      payload: productPayload("cloud-security-suite") as unknown as Prisma.InputJsonValue,
    });
    if (!first.ok) throw new Error("unexpected conflict");

    const conflict = await adminSaveDraft(client, actor, {
      translationId: translation.id,
      expectedVersion: 0,
      schemaVersion: PRODUCT_SCHEMA_VERSION,
      payload: productPayload("stale-slug") as unknown as Prisma.InputJsonValue,
    });
    expect(conflict.ok).toBe(false);
    expect(await client.contentTranslationRevision.count({ where: { translationId: translation.id } })).toBe(1);
  });

  test("a normalized route collision rejects the losing product publish", async ({ testDatabase }) => {
    const { client } = testDatabase;
    const actor = await issueActor(client, "product-route-collision");
    const entityA = await createEntity(client, { contentType: PRODUCT_CONTENT_TYPE });
    const entityB = await createEntity(client, { contentType: PRODUCT_CONTENT_TYPE });
    const translationA = await createTranslation(client, { entityId: entityA.id, locale: "tr" });
    const translationB = await createTranslation(client, { entityId: entityB.id, locale: "tr" });

    const draftA = await adminSaveDraft(client, actor, {
      translationId: translationA.id,
      expectedVersion: 0,
      schemaVersion: PRODUCT_SCHEMA_VERSION,
      payload: productPayload("AYNI-URUN") as unknown as Prisma.InputJsonValue,
    });
    const draftB = await adminSaveDraft(client, actor, {
      translationId: translationB.id,
      expectedVersion: 0,
      schemaVersion: PRODUCT_SCHEMA_VERSION,
      payload: productPayload("ayni-urun") as unknown as Prisma.InputJsonValue,
    });
    if (!draftA.ok || !draftB.ok) throw new Error("unexpected conflict");

    const winner = await adminPublish(
      client,
      actor,
      { translationId: translationA.id, expectedVersion: draftA.translation.version, expectedDraftRevisionId: draftA.revisionId },
      { candidate: productRouteCandidate("tr", "AYNI-URUN") },
    );
    expect(winner.ok).toBe(true);

    const loser = await adminPublish(
      client,
      actor,
      { translationId: translationB.id, expectedVersion: draftB.translation.version, expectedDraftRevisionId: draftB.revisionId },
      { candidate: productRouteCandidate("tr", "ayni-urun") },
    );
    expect(loser.ok).toBe(false);
    if (!loser.ok) expect("routeConflict" in loser && loser.routeConflict).toBe(true);
  });
});

test.describe("AC-3.2 - locale-aware Project draft/publish/route contract", () => {
  test("saves a draft, publishes it, and reserves its native route", async ({ testDatabase }) => {
    const { client } = testDatabase;
    const actor = await issueActor(client, "project-basic");
    const entity = await createEntity(client, { contentType: PROJECT_CONTENT_TYPE });
    const en = await createTranslation(client, { entityId: entity.id, locale: "en" });

    const draft = await adminSaveDraft(client, actor, {
      translationId: en.id,
      expectedVersion: en.version,
      schemaVersion: PROJECT_SCHEMA_VERSION,
      payload: projectPayload("data-center-modernization") as unknown as Prisma.InputJsonValue,
    });
    if (!draft.ok) throw new Error("project draft unexpectedly conflicted");

    const published = await adminPublish(
      client,
      actor,
      { translationId: en.id, expectedVersion: draft.translation.version, expectedDraftRevisionId: draft.revisionId },
      { candidate: projectRouteCandidate("en", "data-center-modernization") },
    );
    expect(published.ok).toBe(true);

    await expect(
      findPublishedProjectByRoute(client, "en", "projects", "data-center-modernization"),
    ).resolves.toEqual({ entityId: entity.id });
    await expect(
      findPublishedProjectByRoute(client, "en", "projects", "unknown-project"),
    ).resolves.toBeNull();
  });

  test("rejects an invalid project payload (missing category) with a classified error", async ({ testDatabase }) => {
    const { client } = testDatabase;
    const actor = await issueActor(client, "project-invalid");
    const entity = await createEntity(client, { contentType: PROJECT_CONTENT_TYPE });
    const translation = await createTranslation(client, { entityId: entity.id, locale: "tr" });

    await expect(
      adminSaveDraft(client, actor, {
        translationId: translation.id,
        expectedVersion: 0,
        schemaVersion: PROJECT_SCHEMA_VERSION,
        payload: { ...projectPayload("gecersiz"), category: "" } as unknown as Prisma.InputJsonValue,
      }),
    ).rejects.toMatchObject({ classification: "invalidInput" });
  });
});
