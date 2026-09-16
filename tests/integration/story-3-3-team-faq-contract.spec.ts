import { randomUUID } from "node:crypto";
import { expect, test } from "../support/merged-fixtures";
import type { Prisma } from "@prisma/client";
import { createEntity, createTranslation } from "../../lib/content-model/model";
import { issueTestAdminContext } from "../../lib/content-model/admin-context-test-support";
import type { AdminContext } from "../../lib/content-model/admin-context";
import { adminPublish, adminSaveDraft } from "../../lib/content-model/admin-content-store";
import {
  FAQ_CONTENT_TYPE,
  FAQ_SCHEMA_VERSION,
  TEAM_MEMBER_CONTENT_TYPE,
  TEAM_MEMBER_SCHEMA_VERSION,
  type FaqPayload,
  type TeamMemberPayload,
} from "../../lib/content-model/payload-validation";
import { teamMemberRouteCandidate } from "../../lib/content-model/team-routes";
import { findPublishedTeamMemberByRoute } from "../../lib/content-model/team-route-lookup";

test.setTimeout(120_000);

function teamPayload(slug: string, overrides: Partial<TeamMemberPayload> = {}): TeamMemberPayload {
  return {
    name: "Ayşe Yılmaz",
    slug,
    role: "Baş Mühendis",
    imageAssetId: null,
    email: "ayse@example.test",
    phone: null,
    social: { instagram: null, linkedin: "https://linkedin.com/in/ayse" },
    bio: "<p>Kısa biyografi.</p>",
    seoTitle: null,
    seoDescription: null,
    ...overrides,
  };
}

function faqPayload(overrides: Partial<FaqPayload> = {}): FaqPayload {
  return {
    question: "Hizmet süresi ne kadar?",
    answer: "<p>Ortalama iki hafta.</p>",
    ...overrides,
  };
}

async function issueActor(client: Parameters<typeof createEntity>[0], label: string): Promise<AdminContext> {
  const user = await client.adminUser.create({
    data: { email: `${label}-${randomUUID()}@example.test`, passwordHash: "unused", name: "Story 3.3 Actor" },
  });
  return issueTestAdminContext({ id: user.id, email: user.email });
}

test.describe("AC-3.3 - locale-aware Team member draft/publish/route contract", () => {
  test("saves a Turkish team draft, publishes it, and reserves /ekip/:slug", async ({ testDatabase }) => {
    const { client } = testDatabase;
    const actor = await issueActor(client, "team-basic");
    const entity = await createEntity(client, { contentType: TEAM_MEMBER_CONTENT_TYPE });
    const tr = await createTranslation(client, { entityId: entity.id, locale: "tr" });

    const draft = await adminSaveDraft(client, actor, {
      translationId: tr.id,
      expectedVersion: tr.version,
      schemaVersion: TEAM_MEMBER_SCHEMA_VERSION,
      payload: teamPayload("ayse-yilmaz") as unknown as Prisma.InputJsonValue,
    });
    if (!draft.ok) throw new Error("team draft unexpectedly conflicted");

    const published = await adminPublish(
      client,
      actor,
      { translationId: tr.id, expectedVersion: draft.translation.version, expectedDraftRevisionId: draft.revisionId },
      { candidate: teamMemberRouteCandidate("tr", "ayse-yilmaz") },
    );
    expect(published.ok).toBe(true);

    await expect(findPublishedTeamMemberByRoute(client, "tr", "ekip", "ayse-yilmaz")).resolves.toEqual({ entityId: entity.id });
  });

  test("rejects a normalized team route collision", async ({ testDatabase }) => {
    const { client } = testDatabase;
    const actor = await issueActor(client, "team-route-collision");
    const entityA = await createEntity(client, { contentType: TEAM_MEMBER_CONTENT_TYPE });
    const entityB = await createEntity(client, { contentType: TEAM_MEMBER_CONTENT_TYPE });
    const translationA = await createTranslation(client, { entityId: entityA.id, locale: "tr" });
    const translationB = await createTranslation(client, { entityId: entityB.id, locale: "tr" });

    const draftA = await adminSaveDraft(client, actor, {
      translationId: translationA.id,
      expectedVersion: 0,
      schemaVersion: TEAM_MEMBER_SCHEMA_VERSION,
      payload: teamPayload("AYSE-YILMAZ") as unknown as Prisma.InputJsonValue,
    });
    const draftB = await adminSaveDraft(client, actor, {
      translationId: translationB.id,
      expectedVersion: 0,
      schemaVersion: TEAM_MEMBER_SCHEMA_VERSION,
      payload: teamPayload("ayse-yilmaz") as unknown as Prisma.InputJsonValue,
    });
    if (!draftA.ok || !draftB.ok) throw new Error("unexpected conflict");

    const winner = await adminPublish(
      client,
      actor,
      { translationId: translationA.id, expectedVersion: draftA.translation.version, expectedDraftRevisionId: draftA.revisionId },
      { candidate: teamMemberRouteCandidate("tr", "AYSE-YILMAZ") },
    );
    expect(winner.ok).toBe(true);

    const loser = await adminPublish(
      client,
      actor,
      { translationId: translationB.id, expectedVersion: draftB.translation.version, expectedDraftRevisionId: draftB.revisionId },
      { candidate: teamMemberRouteCandidate("tr", "ayse-yilmaz") },
    );
    expect(loser.ok).toBe(false);
    if (!loser.ok) expect("routeConflict" in loser && loser.routeConflict).toBe(true);
  });
});

test.describe("AC-3.3 - FAQ draft/publish/no-route contract", () => {
  test("publishes FAQ content without creating a per-item route", async ({ testDatabase }) => {
    const { client } = testDatabase;
    const actor = await issueActor(client, "faq-basic");
    const entity = await createEntity(client, { contentType: FAQ_CONTENT_TYPE });
    const tr = await createTranslation(client, { entityId: entity.id, locale: "tr" });

    const draft = await adminSaveDraft(client, actor, {
      translationId: tr.id,
      expectedVersion: tr.version,
      schemaVersion: FAQ_SCHEMA_VERSION,
      payload: faqPayload() as unknown as Prisma.InputJsonValue,
    });
    if (!draft.ok) throw new Error("FAQ draft unexpectedly conflicted");

    const published = await adminPublish(client, actor, {
      translationId: tr.id,
      expectedVersion: draft.translation.version,
      expectedDraftRevisionId: draft.revisionId,
    });
    expect(published.ok).toBe(true);
    await expect(client.contentRoute.count({ where: { entityId: entity.id } })).resolves.toBe(0);
  });
});
