import { expect, test } from "../support/merged-fixtures";
import type { PrismaClient } from "@prisma/client";
import { ensureHomeSectionRegistry } from "../../lib/content-model/home-section-registry";
import { adminGetHomeSectionEditorView } from "../../lib/content-model/home-section-editor-store";
import { adminSaveDraft } from "../../lib/content-model/admin-content-store";
import { defaultHomeSectionPayload, HOME_SECTION_SCHEMA_VERSION } from "../../lib/content-model/home-section-schemas";
import type { AdminContext } from "../../lib/content-model/admin-context";
import { issueTestAdminContext } from "../../lib/content-model/admin-context-test-support";
import { ContentModelError } from "../../lib/content-model/errors";

test.setTimeout(120_000);

async function bootstrapAdminContext(
  client: PrismaClient,
  overrides: Partial<{ id: string; email: string; name: string }> = {},
): Promise<AdminContext> {
  const user = await client.adminUser.create({
    data: {
      email: overrides.email ?? `home-admin-${Math.random().toString(36).slice(2)}@example.com`,
      passwordHash: "hash",
      name: overrides.name ?? "Home Admin",
    },
  });
  return issueTestAdminContext({ id: user.id, email: user.email });
}

test.describe("Story 2.2 Integration - Home Section Editor Store & Draft Flow", () => {
  test("AC-2.2-01 - adminGetHomeSectionEditorView resolves section view and rejects forged context", async ({
    testDatabase,
  }) => {
    const { client } = testDatabase;
    await ensureHomeSectionRegistry(client);
    const context = await bootstrapAdminContext(client);

    const view = await adminGetHomeSectionEditorView(client, context, "hero", "tr");

    expect(view.key).toBe("hero");
    expect(view.label).toBe("Hero Section");
    expect(view.locale).toBe("tr");
    expect(view.version).toBe(0);
    expect(view.status).toBe("missing");
    expect(view.isDraftPending).toBe(false);
    expect(view.payload.blocks).toHaveLength(1);
    expect(view.payload.blocks[0].type).toBe("text");

    // Forged context rejection
    const forged = Object.create(context) as AdminContext;
    await expect(adminGetHomeSectionEditorView(client, forged, "hero", "tr")).rejects.toBeInstanceOf(
      ContentModelError,
    );
  });

  test("AC-2.2-02 - adminSaveDraft creates immutable revision, moves draft pointer, leaves published pointer null", async ({
    testDatabase,
  }) => {
    const { client } = testDatabase;
    await ensureHomeSectionRegistry(client);
    const context = await bootstrapAdminContext(client);

    const viewBefore = await adminGetHomeSectionEditorView(client, context, "about", "en");
    expect(viewBefore.status).toBe("missing");

    const payload = defaultHomeSectionPayload("about");
    const block = payload.blocks[0];
    if (block.type === "text") {
      block.html = "<p>Sanitized English text with <strong>bold</strong><script>bad()</script></p>";
    }

    const saveResult = await adminSaveDraft(client, context, {
      translationId: viewBefore.translationId,
      expectedVersion: viewBefore.version,
      schemaVersion: HOME_SECTION_SCHEMA_VERSION,
      payload,
    });

    expect(saveResult.ok).toBe(true);
    if (!saveResult.ok) return;
    expect(saveResult.translation.draftRevisionId).not.toBeNull();
    expect(saveResult.translation.publishedRevisionId).toBeNull();
    expect(saveResult.translation.version).toBe(viewBefore.version + 1);

    // Verify sanitized payload in database
    const revision = await client.contentTranslationRevision.findUniqueOrThrow({
      where: { id: saveResult.translation.draftRevisionId! },
    });
    const savedPayload = revision.payload as { blocks: Array<{ type: string; html?: string }> };
    expect(savedPayload.blocks[0].html).toBe("<p>Sanitized English text with <strong>bold</strong></p>");
    expect(savedPayload.blocks[0].html).not.toContain("<script>");

    // Verify view after save
    const viewAfter = await adminGetHomeSectionEditorView(client, context, "about", "en");
    expect(viewAfter.status).toBe("draft");
    expect(viewAfter.isDraftPending).toBe(true);
    expect(viewAfter.version).toBe(viewBefore.version + 1);
  });

  test("AC-2.2-01 - draft save for one locale isolates from other locales", async ({ testDatabase }) => {
    const { client } = testDatabase;
    await ensureHomeSectionRegistry(client);
    const context = await bootstrapAdminContext(client);

    const viewTrBefore = await adminGetHomeSectionEditorView(client, context, "services", "tr");
    const viewEnBefore = await adminGetHomeSectionEditorView(client, context, "services", "en");

    // Save draft for en
    const enPayload = defaultHomeSectionPayload("services");
    const enBlock = enPayload.blocks[0];
    if (enBlock.type === "text") {
      enBlock.html = "<p>English Services Title</p>";
    }

    await adminSaveDraft(client, context, {
      translationId: viewEnBefore.translationId,
      expectedVersion: viewEnBefore.version,
      schemaVersion: HOME_SECTION_SCHEMA_VERSION,
      payload: enPayload,
    });

    const viewTrAfter = await adminGetHomeSectionEditorView(client, context, "services", "tr");
    const viewEnAfter = await adminGetHomeSectionEditorView(client, context, "services", "en");

    // EN updated
    expect(viewEnAfter.status).toBe("draft");
    expect(viewEnAfter.version).toBe(viewEnBefore.version + 1);

    // TR completely unchanged
    expect(viewTrAfter.status).toBe("missing");
    expect(viewTrAfter.version).toBe(viewTrBefore.version);
    expect(viewTrAfter.translationId).toBe(viewTrBefore.translationId);
  });

  test("AC-2.2-04 - stale expectedVersion triggers safe conflict without mutation", async ({ testDatabase }) => {
    const { client } = testDatabase;
    await ensureHomeSectionRegistry(client);
    const context = await bootstrapAdminContext(client);

    const view = await adminGetHomeSectionEditorView(client, context, "hero", "tr");
    const payload = defaultHomeSectionPayload("hero");

    // First save succeeds
    const firstSave = await adminSaveDraft(client, context, {
      translationId: view.translationId,
      expectedVersion: view.version,
      schemaVersion: HOME_SECTION_SCHEMA_VERSION,
      payload,
    });
    expect(firstSave.ok).toBe(true);
    if (!firstSave.ok) return;
    // Second save with stale version
    const staleSave = await adminSaveDraft(client, context, {
      translationId: view.translationId,
      expectedVersion: view.version, // stale expected version 0
      schemaVersion: HOME_SECTION_SCHEMA_VERSION,
      payload,
    });

    expect(staleSave.ok).toBe(false);
    if (staleSave.ok) return;
    expect(staleSave.conflict).toBe(true);
    expect(staleSave.current.version).toBe(view.version + 1);
  });
});
