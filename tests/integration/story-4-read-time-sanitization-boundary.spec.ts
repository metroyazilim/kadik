import { expect, test } from "../support/merged-fixtures";
import { createEntity, createTranslation } from "../../lib/content-model/model";
import { resolve } from "../../lib/content-model/public-content-reader";
import { parseHomeBlocksForRender } from "../../lib/content-model/home-section-schemas";
import {
  FAQ_CONTENT_TYPE,
  FAQ_SCHEMA_VERSION,
  TEAM_MEMBER_CONTENT_TYPE,
  TEAM_MEMBER_SCHEMA_VERSION,
  SERVICE_CONTENT_TYPE,
  SERVICE_SCHEMA_VERSION,
  type FaqPayload,
  type TeamMemberPayload,
  type ServicePayload,
} from "../../lib/content-model/payload-validation";

// Spec 4 AC-4.9: every one of the seven `dangerouslySetInnerHTML` render
// sites must receive HTML that already passed the read-time re-sanitization
// boundary, even for a payload that never went through the write-time
// validator at all (a poisoned row written directly to the database,
// simulating a hypothetical future write-boundary regression). This proves
// the read-time boundary is an independent authority, not merely a mirror
// of the write-time one.

const POISONED_HTML = '<script>alert(1)</script><p onclick="steal()">Safe text</p>';

async function poisonedPublishedTranslation(
  client: Parameters<typeof createEntity>[0],
  contentType: string,
  schemaVersion: number,
  payload: unknown,
) {
  const entity = await createEntity(client, { contentType });
  const translation = await createTranslation(client, { entityId: entity.id, locale: "tr" });
  const revision = await client.contentTranslationRevision.create({
    data: {
      translationId: translation.id,
      schemaVersion,
      payload: payload as never,
      createdBy: "story-4-poisoned-fixture",
    },
  });
  await client.contentTranslation.update({
    where: { id: translation.id },
    data: { publishedRevisionId: revision.id, publishedAt: new Date(), version: { increment: 1 } },
  });
  return entity.id;
}

test.describe("Spec 4 AC-4.9 - read-time sanitization boundary is an independent authority", () => {
  test("a poisoned FAQ answer written directly to the database (bypassing validateAndSanitizeRichText) is inert once resolve() serves it - the source FaqAccordion renders", async ({
    testDatabase,
  }) => {
    const { client } = testDatabase;
    const entityId = await poisonedPublishedTranslation(client, FAQ_CONTENT_TYPE, FAQ_SCHEMA_VERSION, {
      question: "Q",
      answer: POISONED_HTML,
    });

    const result = await resolve(client, { entityId, contentType: FAQ_CONTENT_TYPE, requestedLocale: "tr" });
    const payload = result.payload as unknown as FaqPayload;

    expect(payload.answer).not.toContain("<script");
    expect(payload.answer).not.toContain("onclick");
    expect(payload.answer).toContain("Safe text");
  });

  test("a poisoned Team bio written directly to the database is inert once resolve() serves it - the source team-member-detail.tsx renders", async ({
    testDatabase,
  }) => {
    const { client } = testDatabase;
    const entityId = await poisonedPublishedTranslation(client, TEAM_MEMBER_CONTENT_TYPE, TEAM_MEMBER_SCHEMA_VERSION, {
      name: "N",
      slug: "poisoned-bio-fixture",
      role: "R",
      email: null,
      phone: null,
      imageAssetId: null,
      social: null,
      bio: POISONED_HTML,
      skills: null,
      education: null,
      seoTitle: null,
      seoDescription: null,
    });

    const result = await resolve(client, { entityId, contentType: TEAM_MEMBER_CONTENT_TYPE, requestedLocale: "tr" });
    const payload = result.payload as unknown as TeamMemberPayload;

    expect(payload.bio).not.toContain("<script");
    expect(payload.bio).not.toContain("onclick");
    expect(payload.bio).toContain("Safe text");
  });

  test("a poisoned Service TEXT block written directly to the database is inert once resolve() serves it - the source ContentBlocks renderers render", async ({
    testDatabase,
  }) => {
    const { client } = testDatabase;
    const entityId = await poisonedPublishedTranslation(client, SERVICE_CONTENT_TYPE, SERVICE_SCHEMA_VERSION, {
      title: "T",
      slug: "poisoned-block-fixture",
      summary: "S",
      icon: null,
      imageAssetId: null,
      blocks: [{ id: "blk-1", type: "text", html: POISONED_HTML }],
      seoTitle: null,
      seoDescription: null,
    });

    const result = await resolve(client, { entityId, contentType: SERVICE_CONTENT_TYPE, requestedLocale: "tr" });
    const payload = result.payload as unknown as ServicePayload;
    const textBlock = payload.blocks.find(
      (block): block is Extract<ServicePayload["blocks"][number], { type: "text" }> => block.type === "text",
    );

    expect(textBlock).toBeDefined();
    expect(textBlock?.html).not.toContain("<script");
    expect(textBlock?.html).not.toContain("onclick");
    expect(textBlock?.html).toContain("Safe text");
  });

  test("a poisoned Home section TEXT/BANNER body never reaches HomeComposed's dangerouslySetInnerHTML sites unsanitized", () => {
    const poisonedPayload = {
      blocks: [
        { id: "blk-text", type: "text", visible: true, html: POISONED_HTML },
        {
          id: "blk-banner",
          type: "banner",
          visible: true,
          title: "T",
          body: POISONED_HTML,
          mediaAssetId: null,
          cta: null,
        },
      ],
    };

    const blocks = parseHomeBlocksForRender(poisonedPayload);
    const textBlock = blocks.find((block): block is Extract<typeof blocks[number], { type: "text" }> => block.type === "text");
    const bannerBlock = blocks.find(
      (block): block is Extract<typeof blocks[number], { type: "banner" }> => block.type === "banner",
    );

    expect(textBlock?.html).not.toContain("<script");
    expect(textBlock?.html).not.toContain("onclick");
    expect(textBlock?.html).toContain("Safe text");
    expect(bannerBlock?.body).not.toContain("<script");
    expect(bannerBlock?.body).not.toContain("onclick");
    expect(bannerBlock?.body).toContain("Safe text");
  });
});

