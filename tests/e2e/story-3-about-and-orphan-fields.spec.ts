import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import type { Page } from "@playwright/test";
import { expect, test, log } from "../support/merged-fixtures";

// Spec 3 - About onto CMS, plus the orphan/conflicting site-settings field
// cutover (mission/vision, contact, legal). About is a registry singleton
// (`ContentPageRegistry.key = "about"`, bootstrapped once, never a second
// entity) - unlike Service's per-test fresh entity, every test here edits
// the one real About/site-settings row the dev server already serves, so
// each test restores what it changed in a `finally` and asserts through a
// unique marker rather than assuming a particular starting value.
//
// `/ar/about` and `/ru/about` are not exercised here: both are pre-existing
// 404s (Spec 2 evidence) - `app/ru/[collection]` and `app/ar/[collection]`
// are literal folders that shadow any `/ru/<segment>`/`/ar/<segment>`
// address before Next.js ever reaches `[locale]/about`. AC-3.4's fallback/
// noindex/canonical contract is proven via `/en/about` instead, the one
// non-Turkish About address that is actually reachable.
//
// `role="status"` alone is ambiguous on every drawer/panel here: dnd-kit's
// `SortableList` (About's features/offeringLabels/marquee groups, and
// site-settings' navigation/footer groups) each mount their own
// `aria-live` announcer with the same role. Every status assertion below
// filters by its own message text first, never a bare role lookup.

function statusText(page: Page, text: string) {
  return page.getByRole("status").filter({ hasText: text });
}

async function login(page: Page, adminSeed: { email: string; password: string }): Promise<void> {
  await page.goto("/manage/login");
  await page.getByLabel("E-posta").fill(adminSeed.email);
  await page.getByLabel("Şifre").fill(adminSeed.password);
  await page.getByRole("button", { name: "Giriş yap" }).click();
  await page.waitForURL(/\/manage(\?|$)/);
}

async function openAboutDrawer(page: Page, locale: "tr" | "en" = "tr"): Promise<void> {
  await page.goto(`/manage/pages?locale=${locale}`);
  await expect(page.locator('input[name="banner"]')).toBeVisible();
}

async function saveAboutDraft(page: Page, expectedLocaleLabel: string): Promise<void> {
  const versionField = page.locator('input[name="expectedVersion"]');
  const versionBefore = await versionField.inputValue();
  await page.getByRole("button", { name: "Taslağı kaydet" }).click();
  await expect(statusText(page, `${expectedLocaleLabel} taslağı kaydedildi.`)).toBeVisible();
  // Same stale-refetch-window guard as story-3-1-service-crud.spec.ts's own
  // `saveDraft` helper: wait for the drawer's own background refetch to
  // repoint the hidden concurrency tokens before the next mutation.
  await expect(versionField).not.toHaveValue(versionBefore);
}

async function publishAbout(page: Page, expectedLocaleLabel: string): Promise<void> {
  await page.getByRole("button", { name: "Bu dili yayınla" }).click();
  await expect(statusText(page, `${expectedLocaleLabel} yayınlandı.`)).toBeVisible();
}

test.describe("Spec 3 - About admin-managed end to end (AC-3.1, AC-3.3, AC-3.6)", () => {
  test.describe.configure({ mode: "serial" });

  test("[P0] a Turkish draft stays invisible on /hakkimizda until published, then the drawer refetches its tokens without a manual reload", async ({ page, adminSeed }) => {
    const marker = `About-e2e-${randomUUID().slice(0, 8)}`;

    await log.step("Log in and open the Turkish About drawer");
    await login(page, adminSeed);
    await openAboutDrawer(page, "tr");
    const bannerField = page.locator('input[name="banner"]');
    const originalBanner = await bannerField.inputValue();

    try {
      await log.step("Save a draft with a unique marker banner");
      await bannerField.fill(marker);
      const draftRevisionField = page.locator('input[name="draftRevisionId"]');
      const draftRevisionBefore = await draftRevisionField.inputValue();
      await saveAboutDraft(page, "TR");
      // AC-3.6: the drawer's own refetch repointed draftRevisionId - proof
      // the background refetch ran, not just that the request resolved.
      await expect(draftRevisionField).not.toHaveValue(draftRevisionBefore);

      await log.step("Confirm the draft marker is absent from the public page");
      const before = await page.request.get("/hakkimizda");
      expect(await before.text()).not.toContain(marker);

      await log.step("Publish and confirm the marker is now live");
      await publishAbout(page, "TR");
      await page.goto("/hakkimizda");
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(marker);
    } finally {
      await log.step("Restore the original banner");
      await page.goto("/manage/pages?locale=tr");
      await bannerField.fill(originalBanner);
      await saveAboutDraft(page, "TR");
      await publishAbout(page, "TR");
    }

    await page.goto("/hakkimizda");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(originalBanner);
  });
});

test.describe("Spec 3 - Turkish-fallback About view (AC-3.4)", () => {
  test.describe.configure({ mode: "serial" });

  test("[P0] an unpublished English About renders the Turkish fallback with a visible notice, noindex, and canonical to /hakkimizda", async ({ page }) => {
    const prisma = new PrismaClient();
    let enPublishedRevisionId: string | null = null;
    try {
      const registry = await prisma.contentPageRegistry.findUniqueOrThrow({ where: { key: "about" } });
      const en = await prisma.contentTranslation.findUniqueOrThrow({
        where: { entityId_locale: { entityId: registry.entityId, locale: "en" } },
      });
      enPublishedRevisionId = en.publishedRevisionId;
      await prisma.contentTranslation.update({ where: { id: en.id }, data: { publishedRevisionId: null } });

      await page.goto("/en/about");
      await expect(page.getByRole("status")).toContainText("not yet published in English");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

      const metadata = await page.evaluate(() => {
        const robots = document.querySelector('meta[name="robots"]');
        const canonical = document.querySelector('link[rel="canonical"]');
        return { robots: robots?.getAttribute("content") ?? "", canonical: canonical?.getAttribute("href") ?? "" };
      });
      expect(metadata.robots).toMatch(/noindex/i);
      expect(new URL(metadata.canonical).pathname).toBe("/hakkimizda");
    } finally {
      const registry = await prisma.contentPageRegistry.findUniqueOrThrow({ where: { key: "about" } });
      const en = await prisma.contentTranslation.findUniqueOrThrow({
        where: { entityId_locale: { entityId: registry.entityId, locale: "en" } },
      });
      await prisma.contentTranslation.update({ where: { id: en.id }, data: { publishedRevisionId: enPublishedRevisionId } });
      await prisma.$disconnect();
    }

    await page.goto("/en/about");
    await expect(page.getByRole("status")).toHaveCount(0);
  });
});

test.describe("Spec 3 - mission/vision reach the public page (AC-3.9)", () => {
  test("[P0] publishing site-settings mission/vision changes /misyon-ve-vizyon", async ({ page, adminSeed }) => {
    const marker = `mission-e2e-${randomUUID().slice(0, 8)}`;

    await login(page, adminSeed);
    await page.goto("/manage/site-settings?locale=tr");
    await page.getByLabel("Misyon").fill(marker);
    await page.getByRole("button", { name: "Taslağı kaydet" }).click();
    await expect(statusText(page, "TR taslağı kaydedildi.")).toBeVisible();
    await page.getByRole("button", { name: "Bu dili yayınla" }).click();
    await expect(statusText(page, "TR yayınlandı.")).toBeVisible();

    await page.goto("/misyon-ve-vizyon");
    await expect(page.getByRole("main")).toContainText(marker);
  });
});

test.describe("Spec 3 - one contact authority (AC-3.10)", () => {
  test("[P0] the contact page shows the same published phone as the header/footer on the same request", async ({ page, adminSeed }) => {
    const phone = `+90 555 ${Math.floor(100 + Math.random() * 900)} ${Math.floor(10 + Math.random() * 90)} ${Math.floor(10 + Math.random() * 90)}`;

    await login(page, adminSeed);
    await page.goto("/manage/site-settings?locale=tr");
    await page.getByLabel("Telefon").fill(phone);
    await page.getByRole("button", { name: "Taslağı kaydet" }).click();
    await expect(statusText(page, "TR taslağı kaydedildi.")).toBeVisible();
    await page.getByRole("button", { name: "Bu dili yayınla" }).click();
    await expect(statusText(page, "TR yayınlandı.")).toBeVisible();

    await page.goto("/iletisim");
    await expect(page.locator("header")).toContainText(phone);
    await expect(page.getByRole("main")).toContainText(phone);
  });
});

test.describe("Spec 3 - legal pages render published bodies only (AC-3.11)", () => {
  test(
    "[P0] a published terms body renders, and with nothing published anywhere the page is a real 404",
    { annotation: [{ type: "skipNetworkMonitoring" }] },
    async ({ page, adminSeed }) => {
    const marker = `terms-e2e-${randomUUID().slice(0, 8)}`;

    await log.step("Publish a marker terms body and confirm it renders");
    await login(page, adminSeed);
    await page.goto("/manage/site-settings?locale=tr");
    await page.getByRole("textbox", { name: "Kullanım şartları" }).fill(marker);
    await page.getByRole("button", { name: "Taslağı kaydet" }).click();
    await expect(statusText(page, "TR taslağı kaydedildi.")).toBeVisible();
    await page.getByRole("button", { name: "Bu dili yayınla" }).click();
    await expect(statusText(page, "TR yayınlandı.")).toBeVisible();

    await page.goto("/kullanim-sartlari");
    await expect(page.getByRole("main")).toContainText(marker);

    await log.step("With nothing published anywhere, the same address is a real 404");
    const prisma = new PrismaClient();
    let trPublishedRevisionId: string | null = null;
    try {
      const registry = await prisma.siteSettingsRegistry.findUniqueOrThrow({ where: { singleton: true } });
      const tr = await prisma.contentTranslation.findUniqueOrThrow({
        where: { entityId_locale: { entityId: registry.entityId, locale: "tr" } },
      });
      trPublishedRevisionId = tr.publishedRevisionId;
      await prisma.contentTranslation.update({ where: { id: tr.id }, data: { publishedRevisionId: null } });

      const response = await page.goto("/kullanim-sartlari");
      expect(response?.status()).toBe(404);
    } finally {
      const registry = await prisma.siteSettingsRegistry.findUniqueOrThrow({ where: { singleton: true } });
      const tr = await prisma.contentTranslation.findUniqueOrThrow({
        where: { entityId_locale: { entityId: registry.entityId, locale: "tr" } },
      });
      await prisma.contentTranslation.update({ where: { id: tr.id }, data: { publishedRevisionId: trPublishedRevisionId } });
      await prisma.$disconnect();
    }

    await page.goto("/kullanim-sartlari");
    await expect(page.getByRole("main")).toContainText(marker);
  });
});
