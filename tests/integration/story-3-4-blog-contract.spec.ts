import { randomUUID } from "node:crypto";
import { expect, test } from "../support/merged-fixtures";
import type { Prisma } from "@prisma/client";
import { createEntity, createTranslation } from "../../lib/content-model/model";
import { validatePayload } from "../../lib/content-model/payload-validation";
import { ContentModelError } from "../../lib/content-model/errors";
import { issueTestAdminContext } from "../../lib/content-model/admin-context-test-support";
import type { AdminContext } from "../../lib/content-model/admin-context";
import { adminPublish, adminSaveDraft } from "../../lib/content-model/admin-content-store";
import { publish } from "../../lib/content-model/publishing";
import { POST_CONTENT_TYPE, POST_SCHEMA_VERSION } from "../../lib/content-model/payload-validation";
import { POST_COLLECTION_SEGMENTS, postRouteCandidate } from "../../lib/content-model/post-routes";
import { findPublishedPostByRoute } from "../../lib/content-model/post-route-lookup";

test.setTimeout(120_000);

type PostTextBlock = Readonly<{ id: string; type: "text"; html: string }>;

type PostPayload = Readonly<{
  title: string;
  slug: string;
  excerpt: string;
  blocks: readonly PostTextBlock[];
  category: string;
  author: string;
  coverImageAssetId: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
}>;

function postPayload(slug: string, overrides: Partial<PostPayload> = {}): PostPayload {
  return {
    title: "5 IT Security Steps",
    slug,
    excerpt: "A concise locale-owned post excerpt.",
    blocks: [{ id: "b1", type: "text", html: "A complete locale-owned post body." }],
    category: "Security",
    author: "Corporate Starter",
    coverImageAssetId: null,
    seoTitle: "5 IT Security Steps | Metro",
    seoDescription: "Independent guidance on IT security posture.",
    ...overrides,
  };
}

async function issueActor(client: Parameters<typeof createEntity>[0], label: string): Promise<AdminContext> {
  const user = await client.adminUser.create({
    data: {
      email: `${label}-${randomUUID()}@example.test`,
      passwordHash: "unused-in-story-3-4-contract-tests",
      name: "Story 3.4 Contract Actor",
    },
  });
  return issueTestAdminContext({ id: user.id, email: user.email });
}

async function savePostDraft(
  client: Parameters<typeof createEntity>[0],
  actor: AdminContext,
  translationId: string,
  expectedVersion: number,
  payload: PostPayload,
) {
  const result = await adminSaveDraft(client, actor, {
    translationId,
    expectedVersion,
    schemaVersion: POST_SCHEMA_VERSION,
    payload: payload as unknown as Prisma.InputJsonValue,
  });
  if (!result.ok) throw new Error("post draft unexpectedly conflicted");
  return result;
}

async function expectInvalidPostPayload(payload: unknown, schemaVersion = POST_SCHEMA_VERSION) {
  let caught: unknown;
  try {
    validatePayload(POST_CONTENT_TYPE, schemaVersion, payload);
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(ContentModelError);
  if (!(caught instanceof ContentModelError)) throw new Error("expected ContentModelError");
  expect(caught.classification).toBe("invalidInput");
}

test.describe("AC-3.4 - real Blog Post payload schema", () => {
  test("accepts the exact real PostPayload and returns a detached canonical value", () => {
    const input = postPayload("5-it-security-steps");
    const actual = validatePayload(POST_CONTENT_TYPE, POST_SCHEMA_VERSION, input) as unknown as PostPayload;

    expect(actual).toEqual(input);
    expect(actual).not.toBe(input);
    expect(Object.keys(actual).sort()).toEqual([
      "author",
      "blocks",
      "category",
      "coverImageAssetId",
      "excerpt",
      "seoDescription",
      "seoTitle",
      "slug",
      "title",
    ]);
  });

  test("rejects every missing or blank required Post field, and an empty block array", async () => {
    const valid = postPayload("required-fields");
    const invalidPayloads: unknown[] = [
      { ...valid, title: "" },
      { ...valid, slug: "   " },
      { ...valid, excerpt: "\n" },
      { ...valid, category: "" },
      { ...valid, author: "" },
      { ...valid, blocks: [] },
    ];
    for (const payload of invalidPayloads) await expectInvalidPostPayload(payload);
  });

  test("rejects unknown keys and an unsupported Post schema version; publishedAt is never part of the payload", async () => {
    const valid = postPayload("closed-shape");
    await expectInvalidPostPayload({ ...valid, publishedAt: new Date().toISOString() });
    await expectInvalidPostPayload({ ...valid, content: "legacy-field-name" });
    await expectInvalidPostPayload(valid, POST_SCHEMA_VERSION + 1);
  });
});

test.describe("AC-3.4 - locale-aware admin draft/publish contract", () => {
  test("editing and publishing tr leaves the en locale missing and commits immutable revision, pointer, and audit state", async ({ testDatabase }) => {
    const { client } = testDatabase;
    const actor = await issueActor(client, "post-locale-isolation");
    const entity = await createEntity(client, { contentType: POST_CONTENT_TYPE });
    const tr = await createTranslation(client, { entityId: entity.id, locale: "tr" });

    const draft = await savePostDraft(client, actor, tr.id, tr.version, postPayload("bt-guvenligi-5-adim", { title: "BT Güvenliğinde 5 Adım" }));
    const published = await adminPublish(client, actor, {
      translationId: tr.id,
      expectedVersion: draft.translation.version,
      expectedDraftRevisionId: draft.revisionId,
    });

    expect(published.ok).toBe(true);
    if (!published.ok) throw new Error("post publish unexpectedly conflicted");
    expect(published.translation.publishedRevisionId).toBe(draft.revisionId);
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
    const actor = await issueActor(client, "stale-post");
    const entity = await createEntity(client, { contentType: POST_CONTENT_TYPE });
    const translation = await createTranslation(client, { entityId: entity.id, locale: "en" });
    const first = await savePostDraft(client, actor, translation.id, 0, postPayload("first-post"));

    const stalePayload = postPayload("stale-post", { title: "Stale edit" });
    const conflict = await adminSaveDraft(client, actor, {
      translationId: translation.id,
      expectedVersion: 0,
      schemaVersion: POST_SCHEMA_VERSION,
      payload: stalePayload as unknown as Prisma.InputJsonValue,
    });

    expect(conflict.ok).toBe(false);
    if (conflict.ok) throw new Error("stale post draft unexpectedly succeeded");
    expect(conflict.conflict).toBe(true);
    expect(conflict.current.version).toBe(first.translation.version);
    expect(await client.contentTranslationRevision.count({ where: { translationId: translation.id } })).toBe(1);
  });
});

test.describe("AC-3.4 - native route generation and reverse lookup", () => {
  test("canonical locale segments and reverse lookup expose only a published entity", async ({ testDatabase }) => {
    const { client } = testDatabase;
    const actor = await issueActor(client, "global-blog-route");
    const entity = await createEntity(client, { contentType: POST_CONTENT_TYPE });
    const translation = await createTranslation(client, { entityId: entity.id, locale: "en" });
    const draft = await savePostDraft(client, actor, translation.id, 0, postPayload("five-security-steps", { title: "Five Security Steps" }));

    expect(POST_COLLECTION_SEGMENTS).toEqual({
      tr: "blog",
      en: "blog",
    });
    const candidate = postRouteCandidate("en", "five-security-steps");
    const published = await publish(
      client,
      { translationId: translation.id, expectedVersion: 1, expectedDraftRevisionId: draft.revisionId },
      undefined,
      { candidate },
    );
    if (!published.ok) throw new Error("Global post publish unexpectedly failed");

    await expect(findPublishedPostByRoute(client, "en", POST_COLLECTION_SEGMENTS.en, "five-security-steps")).resolves.toEqual({ entityId: entity.id });
    await expect(findPublishedPostByRoute(client, "en", POST_COLLECTION_SEGMENTS.en, "unknown-post")).resolves.toBeNull();

    await client.contentTranslation.update({ where: { id: translation.id }, data: { publishedRevisionId: null } });
    await expect(findPublishedPostByRoute(client, "en", POST_COLLECTION_SEGMENTS.en, "five-security-steps")).resolves.toBeNull();
  });
});
