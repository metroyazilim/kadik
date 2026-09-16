import { expect, test } from "../support/merged-fixtures";
import type { PrismaClient } from "@prisma/client";
import { ensureHomeSectionRegistry } from "../../lib/content-model/home-section-registry";
import { adminGetHomeSectionEditorView } from "../../lib/content-model/home-section-editor-store";
import { adminSaveDraft } from "../../lib/content-model/admin-content-store";
import { confirmHomePublish } from "../../lib/content-model/home-publish-confirm";
import { resolveHomePreflightInputs } from "../../lib/content-model/home-preflight-resolver";
import { runHomePublishPreflight, buildHomePreflightExpectedState } from "../../lib/content-model/home-preflight";
import { HOME_SECTION_SCHEMA_VERSION, type HomeBlock } from "../../lib/content-model/home-section-schemas";
import { loadPublicHomeView } from "../../lib/content-model/home-public-view";
import type { AdminContext } from "../../lib/content-model/admin-context";
import { issueTestAdminContext } from "../../lib/content-model/admin-context-test-support";

test.setTimeout(120_000);

async function bootstrapAdminContext(client: PrismaClient): Promise<AdminContext> {
  const user = await client.adminUser.create({
    data: {
      email: `home-public-${Math.random().toString(36).slice(2)}@example.com`,
      passwordHash: "hash",
      name: "Home Public Admin",
    },
  });
  return issueTestAdminContext({ id: user.id, email: user.email });
}

async function publishHeroTextBlock(client: PrismaClient, context: AdminContext, html: string) {
  const view = await adminGetHomeSectionEditorView(client, context, "hero", "tr");
  const payload = { blocks: [{ id: "block-1", type: "text" as const, visible: true, html }] };
  const saved = await adminSaveDraft(client, context, {
    translationId: view.translationId,
    expectedVersion: view.version,
    schemaVersion: HOME_SECTION_SCHEMA_VERSION,
    payload,
  });
  if (!saved.ok) throw new Error("draft save failed in test setup");

  const selection = { layoutSelected: false, sections: [{ key: "hero" as const, locale: "tr" as const }] };
  const resolved = await resolveHomePreflightInputs(client, selection);
  const matrix = runHomePublishPreflight(resolved);
  const expectedState = buildHomePreflightExpectedState(matrix, resolved.candidateLayoutRevisionId);
  const result = await confirmHomePublish(client, context, { selection, expectedState });
  if (!result.ok) throw new Error("publish failed in test setup");
}

test.describe("Story 2.5 Integration - loadPublicHomeView (public boundary)", () => {
  test("reads only the published revision - a newer, unpublished draft never leaks into the public view", async ({
    testDatabase,
  }) => {
    const { client } = testDatabase;
    await ensureHomeSectionRegistry(client);
    const context = await bootstrapAdminContext(client);

    await publishHeroTextBlock(client, context, "<p>Published headline</p>");

    // Save a newer draft that is never published.
    const view = await adminGetHomeSectionEditorView(client, context, "hero", "tr");
    await adminSaveDraft(client, context, {
      translationId: view.translationId,
      expectedVersion: view.version,
      schemaVersion: HOME_SECTION_SCHEMA_VERSION,
      payload: { blocks: [{ id: "block-1", type: "text", visible: true, html: "<p>Unpublished draft headline</p>" }] },
    });

    const publicView = await loadPublicHomeView(client, "tr");
    const heroSection = publicView.composition.sections.find((section) => section.key === "hero");
    expect(heroSection).toBeDefined();
    const payload = heroSection!.payload as { blocks: HomeBlock[] };
    const [block] = payload.blocks;
    expect(block.type).toBe("text");
    if (block.type === "text") {
      expect(block.html).toBe("<p>Published headline</p>");
      expect(block.html).not.toContain("Unpublished");
    }
  });

  test("resolves a live asset's URL and omits an archived asset's id (fail-safe, never a broken reference)", async ({
    testDatabase,
  }) => {
    const { client } = testDatabase;
    await ensureHomeSectionRegistry(client);
    const context = await bootstrapAdminContext(client);

    const liveAsset = await client.mediaAsset.create({
      data: {
        filename: "live.png",
        objectKey: `test/live-${Math.random().toString(36).slice(2)}.png`,
        url: "https://example.test/live.png",
        mimeType: "image/png",
        extension: ".png",
        byteSize: 10,
        checksum: "live-checksum",
        createdBy: context.actorId,
      },
    });
    const archivedAsset = await client.mediaAsset.create({
      data: {
        filename: "archived.png",
        objectKey: `test/archived-${Math.random().toString(36).slice(2)}.png`,
        url: "https://example.test/archived.png",
        mimeType: "image/png",
        extension: ".png",
        byteSize: 10,
        checksum: "archived-checksum",
        createdBy: context.actorId,
        archivedAt: new Date(),
      },
    });

    const view = await adminGetHomeSectionEditorView(client, context, "hero", "tr");
    await adminSaveDraft(client, context, {
      translationId: view.translationId,
      expectedVersion: view.version,
      schemaVersion: HOME_SECTION_SCHEMA_VERSION,
      payload: {
        blocks: [
          { id: "img-live", type: "image", visible: true, assetId: liveAsset.id, altText: "Live" },
          { id: "img-archived", type: "image", visible: true, assetId: archivedAsset.id, altText: "Archived" },
        ],
      },
    });
    const selection = { layoutSelected: false, sections: [{ key: "hero" as const, locale: "tr" as const }] };
    const resolved = await resolveHomePreflightInputs(client, selection);
    const matrix = runHomePublishPreflight(resolved);
    const expectedState = buildHomePreflightExpectedState(matrix, resolved.candidateLayoutRevisionId);
    const publishResult = await confirmHomePublish(client, context, { selection, expectedState });
    expect(publishResult.ok).toBe(true);

    const publicView = await loadPublicHomeView(client, "tr");
    expect(publicView.mediaAssetsById[liveAsset.id]?.url).toBe("https://example.test/live.png");
    expect(publicView.mediaAssetsById[archivedAsset.id]).toBeUndefined();
  });

  test("a Home section with no published translation in the requested locale is simply absent from the composition", async ({
    testDatabase,
  }) => {
    const { client } = testDatabase;
    await ensureHomeSectionRegistry(client);

    const publicView = await loadPublicHomeView(client, "tr");
    // Nothing has ever been published - every registry section resolves to
    // no content, so the composition renders none of them (AD-7).
    expect(publicView.composition.sections).toHaveLength(0);
    expect(publicView.composition.omittedSections.length).toBeGreaterThan(0);
  });
});
