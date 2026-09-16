// Story 6.2 - proves the real, wired route files (app/sitemap.ts,
// app/robots.ts, /manage/seo) actually render, against the same
// database the `next dev` webServer this config spawns is using, via the
// shared `e2eData` fixture (Spec 5) for actor creation and content-entity
// tracking/cleanup.
import { expect, test } from "../support/merged-fixtures";
import type { Page } from "@playwright/test";
import { createCollectionEntity, ensureLocaleTranslation } from "../../lib/content-model/collection-admin";
import { serviceRouteCandidate } from "../../lib/content-model/service-routes";
import { adminPublish, adminSaveDraft } from "../../lib/content-model/admin-content-store";
import { persistedOutboxRecorder } from "../../lib/content-model/outbox-store";
import { contentAvailabilityTag, contentEntityTag, seoIndexTag } from "../../lib/content-model/cache-tags";
import { SERVICE_CONTENT_TYPE, SERVICE_SCHEMA_VERSION } from "../../lib/content-model/payload-validation";

async function login(page: Page, adminSeed: { email: string; password: string }) {
  await page.goto("/manage/login");
  await page.getByLabel("E-posta").fill(adminSeed.email);
  await page.getByLabel("Şifre").fill(adminSeed.password);
  await page.getByRole("button", { name: "Giriş yap" }).click();
  await page.waitForURL(/\/manage(\?|$)/);
}

test.describe("Story 6.2 - SEO surfaces render for real", () => {
  test("AC-6.2-03 - /sitemap.xml includes a freshly published native Service URL, /robots.txt disallows /manage and references the sitemap", async ({ page, e2eData }) => {
    const marker = `e2e-6-2-sitemap-${crypto.randomUUID().slice(0, 8)}`;
    const admin = await e2eData.createAdminActor(marker);
    const entity = await createCollectionEntity(e2eData.client, admin, SERVICE_CONTENT_TYPE);
    await e2eData.trackContentEntity(entity.entityId);
    const translation = await ensureLocaleTranslation(e2eData.client, admin, entity.entityId, "tr");

    const draft = await adminSaveDraft(e2eData.client, admin, {
      translationId: translation.translationId,
      expectedVersion: translation.version,
      schemaVersion: SERVICE_SCHEMA_VERSION,
      payload: {
        title: marker,
        slug: marker,
        summary: "E2E sitemap fixture summary.",
        blocks: [{ id: "b1", type: "text", html: "E2E sitemap fixture body." }],
        icon: null,
        imageAssetId: null,
        seoTitle: null,
        seoDescription: null,
      },
    });
    if (!draft.ok) throw new Error("unreachable - fresh entity, version 0");

    const published = await adminPublish(
      e2eData.client,
      admin,
      { translationId: translation.translationId, expectedVersion: draft.translation.version, expectedDraftRevisionId: draft.revisionId },
      { candidate: serviceRouteCandidate("tr", marker) },
      { recorder: persistedOutboxRecorder, tags: [contentEntityTag(entity.entityId), contentAvailabilityTag(entity.entityId, "tr"), "service:collection", seoIndexTag()] },
    );
    if (!published.ok) throw new Error("unreachable - fresh route, no conflict possible");

    const sitemapResponse = await page.request.get("/sitemap.xml");
    expect(sitemapResponse.ok()).toBe(true);
    expect(sitemapResponse.headers()["content-type"]).toContain("xml");
    const sitemapBody = await sitemapResponse.text();
    expect(sitemapBody).toContain(`/servisler/${marker}`);

    const robotsResponse = await page.request.get("/robots.txt");
    expect(robotsResponse.ok()).toBe(true);
    const robotsBody = await robotsResponse.text();
    expect(robotsBody).toContain("Disallow: /manage");
    expect(robotsBody).toContain("Sitemap:");
    expect(robotsBody).toContain("/sitemap.xml");
  });

  test("AC-6.2-05 - /manage/seo renders the audit surface with a role=status summary, never a crash", async ({ page, adminSeed }) => {
    await login(page, adminSeed);
    await page.goto("/manage/seo");

    await expect(page.getByRole("heading", { name: "SEO denetimi" })).toBeVisible();
    await expect(page.getByRole("status")).toBeVisible();
  });
});
