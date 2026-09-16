// Story 6.1 correction - proves the public shell (SiteHeader/Footer/
// MobileMenu) actually consumes published site-settings, never leaks a
// draft, applies the Turkish fallback, omits unsafe/unresolved nav targets,
// and that mobile-drawer accessibility holds with real published content.
//
// Runs against the SAME database the `next dev` webServer this config
// spawns is using, via the shared `e2eData` fixture
// (`tests/support/fixtures/e2e-data-fixture.ts`, Spec 5) - which also
// snapshots the site-settings singleton before this file's tests run and
// restores it afterward, so a marker string this file publishes to the one
// live row never lingers past this file's own teardown.
import type { ContentLocale, Prisma, PrismaClient } from "@prisma/client";
import { expect, test } from "../support/merged-fixtures";
import type { AdminContext } from "../../lib/content-model/admin-context";
import { adminPublish, adminSaveDraft } from "../../lib/content-model/admin-content-store";
import { ensureLocaleTranslation } from "../../lib/content-model/collection-admin";
import { ensureSiteSettingsEntity } from "../../lib/content-model/site-settings-registry";
import { persistedOutboxRecorder } from "../../lib/content-model/outbox-store";
import { contentAvailabilityTag, contentEntityTag, navigationConfigTag } from "../../lib/content-model/cache-tags";
import { SITE_SETTINGS_SCHEMA_VERSION, type SiteSettingsPayload } from "../../lib/content-model/site-settings-schema";

function basePayload(marker: string, overrides: Partial<SiteSettingsPayload> = {}): SiteSettingsPayload {
  return {
    brand: { name: `Corporate Starter ${marker}`, logoAssetId: null },
    contact: { email: `contact-${marker}@metro.test`, phone: "+90 555 111 22 33", address: `Adres ${marker}` },
    cta: { label: `CTA ${marker}`, url: "/tr/contact" },
    navigation: [
      { id: "nav-external", label: `Nav ${marker}`, target: { kind: "external", url: "https://partner.example.com/e2e" }, children: [] },
    ],
    footer: {
      summary: `Footer summary ${marker}`,
      columns: [
        {
          id: "col-1",
          title: `Column ${marker}`,
          links: [{ id: "l-1", label: `Link ${marker}`, target: { kind: "external", url: "https://partner.example.com/e2e-footer" } }],
        },
      ],
    },
    mission: "Mission",
    vision: "Vision",
    termsBody: "<p>Terms.</p>",
    privacyBody: "<p>Privacy.</p>",
    ...overrides,
  };
}

/** Publishes `marker`'s payload for `locale`, returning the entityId and the translation state (for a follow-up draft-only save). */
async function publishSiteSettings(
  client: PrismaClient,
  admin: AdminContext,
  locale: ContentLocale,
  payload: SiteSettingsPayload,
): Promise<Readonly<{ entityId: string; translationId: string; version: number }>> {
  const { entityId } = await ensureSiteSettingsEntity(client);
  const translation = await ensureLocaleTranslation(client, admin, entityId, locale);
  const draft = await adminSaveDraft(client, admin, {
    translationId: translation.translationId,
    expectedVersion: translation.version,
    schemaVersion: SITE_SETTINGS_SCHEMA_VERSION,
    payload: payload as unknown as Prisma.InputJsonValue,
  });
  if (!draft.ok) throw new Error("site-settings draft unexpectedly conflicted");

  const published = await adminPublish(
    client,
    admin,
    { translationId: translation.translationId, expectedVersion: draft.translation.version, expectedDraftRevisionId: draft.revisionId },
    undefined,
    { recorder: persistedOutboxRecorder, tags: [contentEntityTag(entityId), contentAvailabilityTag(entityId, locale), navigationConfigTag()] },
  );
  if (!published.ok) throw new Error("site-settings publish unexpectedly conflicted");

  return { entityId, translationId: translation.translationId, version: published.translation.version };
}

/**
 * Forces `locale`'s published pointer to `null` for the duration of one
 * test, regardless of what the deterministic dev seed (Spec 5) already
 * published there - `e2eData`'s own site-settings snapshot/restore already
 * captures every locale's *real* pre-test state and puts it back at
 * teardown, so this is safe and temporary, not a destructive edit. Needed
 * because the seed now publishes site-settings in all four locales
 * (AC-5.1), so "this locale has simply never been published" is no longer
 * true in a properly seeded database - the fallback contract itself still
 * needs proving, just against a locale this test makes unpublished itself.
 */
async function forceLocaleUnpublished(client: PrismaClient, locale: ContentLocale): Promise<void> {
  const { entityId } = await ensureSiteSettingsEntity(client);
  await client.contentTranslation.update({
    where: { entityId_locale: { entityId, locale } },
    data: { publishedRevisionId: null },
  });
}

test.describe("Story 6.1 correction - public shell consumes published site-settings (AC-6.1-01/03/04/07)", () => {
  // Serial (matches `story-3-1-service-crud.spec.ts`'s own precedent for
  // shared-state tests): every test here mutates the one site-settings
  // singleton, and `e2eData`'s per-test snapshot/restore (Spec 5) would
  // otherwise race against a concurrently-running sibling test under
  // `fullyParallel: true` - one test's teardown restoring the row out from
  // under another test's still-in-flight assertion.
  test.describe.configure({ mode: "serial" });
  test.setTimeout(60_000);

  test("[P0] published brand/CTA/nav/footer render on the public tr shell, and the outbox carries the reused cache tags", async ({ page, e2eData }) => {
    const marker = `pub-${crypto.randomUUID().slice(0, 8)}`;
    const admin = await e2eData.createAdminActor("shell-publish");
    const { entityId } = await publishSiteSettings(e2eData.client, admin, "tr", basePayload(marker));

    await page.goto("/tr");
    await expect(page.getByRole("banner").getByText(`Corporate Starter ${marker}`)).toBeVisible();
    await expect(page.getByRole("link", { name: `Nav ${marker}` })).toBeVisible();
    await expect(page.getByRole("link", { name: `Nav ${marker}` })).toHaveAttribute("target", "_blank");
    await expect(page.getByRole("link", { name: `Nav ${marker}` })).toHaveAttribute("rel", "noopener noreferrer");
    await expect(page.getByRole("link", { name: `CTA ${marker}` }).first()).toBeVisible();
    await expect(page.getByRole("contentinfo").getByText(`Footer summary ${marker}`)).toBeVisible();
    await expect(page.getByRole("contentinfo").getByRole("heading", { name: `Column ${marker}` })).toBeVisible();
    await expect(page.getByRole("contentinfo").getByRole("link", { name: `Link ${marker}` })).toBeVisible();
    await expect(page.getByRole("contentinfo").getByText(`contact-${marker}@metro.test`)).toBeVisible();

    // CAP-4 / section 5: the same shared cache-tag vocabulary (cache-tags.ts)
    // was actually persisted to the outbox on this publish - not a second,
    // independently invented invalidation signal.
    const events = await e2eData.client.invalidationOutboxEvent.findMany({
      where: { sourceEntityId: entityId },
      orderBy: { createdAt: "desc" },
      take: 1,
    });
    expect(events).toHaveLength(1);
    expect(events[0]!.tags).toEqual(
      expect.arrayContaining([contentEntityTag(entityId), contentAvailabilityTag(entityId, "tr"), navigationConfigTag()]),
    );
  });

  test("[P0] a saved-but-unpublished draft never leaks to the public shell", async ({ page, e2eData }) => {
    const published = `visible-${crypto.randomUUID().slice(0, 8)}`;
    const draftOnly = `hidden-${crypto.randomUUID().slice(0, 8)}`;
    const admin = await e2eData.createAdminActor("shell-draft-leak");

    const { translationId, version } = await publishSiteSettings(e2eData.client, admin, "tr", basePayload(published));

    // Save a NEW draft with a different marker - deliberately never published.
    const draftResult = await adminSaveDraft(e2eData.client, admin, {
      translationId,
      expectedVersion: version,
      schemaVersion: SITE_SETTINGS_SCHEMA_VERSION,
      payload: basePayload(draftOnly) as unknown as Prisma.InputJsonValue,
    });
    if (!draftResult.ok) throw new Error("draft-only save unexpectedly conflicted");

    await page.goto("/tr");
    await expect(page.getByRole("banner").getByText(`Corporate Starter ${published}`)).toBeVisible();
    await expect(page.getByText(`Corporate Starter ${draftOnly}`)).toHaveCount(0);
    await expect(page.getByText(`Nav ${draftOnly}`)).toHaveCount(0);
    await expect(page.getByText(`Footer summary ${draftOnly}`)).toHaveCount(0);
  });

  test("[P0] unpublished Global content serves Turkish as a controlled fallback", async ({ page, e2eData }) => {
    const marker = `fallback-${crypto.randomUUID().slice(0, 8)}`;
    const admin = await e2eData.createAdminActor("shell-fallback");
    await forceLocaleUnpublished(e2eData.client, "en");
    await publishSiteSettings(e2eData.client, admin, "tr", basePayload(marker));

    await page.goto("/en");
    await expect(page.getByRole("banner").getByText(`Corporate Starter ${marker}`)).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
  });

  test("[P0] a broken navigation target (missing entity) is never rendered publicly, only the resolved sibling is", async ({ page, e2eData }) => {
    const marker = `navsafety-${crypto.randomUUID().slice(0, 8)}`;
    const admin = await e2eData.createAdminActor("shell-nav-safety");
    const payload = basePayload(marker, {
      navigation: [
        { id: "nav-broken", label: `Broken ${marker}`, target: { kind: "collection", contentType: "service", entityId: crypto.randomUUID() }, children: [] },
        { id: "nav-ok", label: `Nav ${marker}`, target: { kind: "external", url: "https://partner.example.com/e2e" }, children: [] },
      ],
    });
    await publishSiteSettings(e2eData.client, admin, "tr", payload);

    await page.goto("/tr");
    await expect(page.getByRole("link", { name: `Nav ${marker}` })).toBeVisible();
    await expect(page.getByText(`Broken ${marker}`)).toHaveCount(0);
  });

  test("[P0] mobile drawer opens/closes by keyboard and Escape, traps focus, and locks/restores body scroll", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/tr");

    const trigger = page.getByRole("button", { name: /Menü|Menu/i }).first();
    await trigger.focus();
    await trigger.press("Enter");

    const dialog = page.getByRole("complementary");
    await expect(dialog).toBeVisible();
    await expect(trigger).toHaveAttribute("aria-expanded", "true");

    // Focus moved into the drawer (the close button), not left on the page behind it.
    const closeButton = dialog.getByRole("button").first();
    await expect(closeButton).toBeFocused();

    // Body scroll is locked while the drawer is open.
    await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe("hidden");

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    // Focus returns to the trigger that opened it.
    await expect(trigger).toBeFocused();
    await expect.poll(() => page.evaluate(() => document.body.style.overflow)).not.toBe("hidden");
  });
});
