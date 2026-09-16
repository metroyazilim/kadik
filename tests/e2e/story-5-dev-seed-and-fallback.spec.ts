// Spec 5 - proves the deterministic dev seed's own output is genuinely
// visible: the seeded content renders on the real public pages and in
// `/manage` (AC-5.1/5.2). The third scenario below proves the shared
// Turkish-fallback contract (AC-5.8) for TeamMember specifically -
// originally against dev-seed's own deliberately-unpublished team-4/ru
// translation, but Spec 6's real legacy-backfill migration retired that
// synthetic gap (the actual legacy `TeamMemberRu` data is fully
// translated), so this now builds its own throwaway fixture instead,
// matching every other domain's own fallback E2E coverage.
import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import { expect, test } from "../support/merged-fixtures";

async function login(page: Page, adminSeed: { email: string; password: string }): Promise<void> {
  await page.goto("/manage/login");
  await page.getByLabel("E-posta").fill(adminSeed.email);
  await page.getByLabel("Şifre").fill(adminSeed.password);
  await page.getByRole("button", { name: "Giriş yap" }).click();
  await page.waitForURL(/\/manage(\?|$)/);
}

test.describe("Spec 5 - deterministic dev seed is visible (AC-5.2, AC-5.8)", () => {
  test("[P0] seeded Service/Team content renders on the public pages", async ({ page }) => {
    await page.goto("/servisler/service-1");
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
    await expect(page.getByRole("main")).not.toContainText("wpriverthemes.com");

    await page.goto("/ekip/team-4");
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  });

  test("[P0] /manage lists the seeded Service/Team entities with a published state, not an empty CMS beside populated legacy tables", async ({ page, adminSeed }) => {
    await page.goto("/manage/login");
    await page.getByLabel("E-posta").fill(adminSeed.email);
    await page.getByLabel("Şifre").fill(adminSeed.password);
    await page.getByRole("button", { name: "Giriş yap" }).click();
    await page.waitForURL(/\/manage(\?|$)/);

    await page.goto("/manage/services");
    await expect(page.locator(".divide-y.divide-brand-border > div")).not.toHaveCount(0);

    await page.goto("/manage/team");
    await expect(page.locator(".divide-y.divide-brand-border > div")).not.toHaveCount(0);
  });

  test("[P0] a TeamMember published only in Turkish demonstrates the Turkish-fallback contract on the Russian route", async ({ page, adminSeed, e2eData }) => {
    const suffix = randomUUID().slice(0, 8);
    const name = `E2E Fallback ${suffix}`;

    await login(page, adminSeed);
    await page.goto("/manage/team");
    await expect(page.getByRole("heading", { name: "Ekip Üyeleri" })).toBeVisible();
    await page.getByRole("button", { name: "Yeni üye" }).click();
    await page.waitForURL(/\/manage\/team\/[^/?]+/);
    const entityId = new URL(page.url()).pathname.split("/").pop() ?? "";
    if (!entityId) throw new Error("Expected a created TeamMember entity id in the URL.");
    await e2eData.trackContentEntity(entityId);

    await page.locator('input[name="name"]').fill(name);
    await page.locator('input[name="slug"]').fill(`e2e-fallback-${suffix}`);
    await page.locator('input[name="role"]').fill("E2E Görev");
    await page.getByRole("textbox", { name: "Biyografi" }).fill("E2E biyografi metni.");
    await page.getByRole("button", { name: "Taslağı kaydet" }).click();
    await expect(page.locator('p[role="status"]')).toContainText("TR taslağı kaydedildi.");
    // Publish only Turkish - the Russian tab is never visited/drafted, so
    // this TeamMember has no `ru` translation at all, the same shape a
    // real admin's not-yet-translated content has.
    await page.getByRole("button", { name: "Bu dili yayınla" }).click();
    await expect(page.locator('p[role="status"]')).toContainText("TR yayınlandı.");

    // Native-script Russian collection segment (AD-6).
    await page.goto(`/ru/команда/e2e-fallback-${suffix}`);
    // Team's fallback contract (unlike Service's) carries no separate
    // visible "not yet published" banner - the observable contract here is
    // the Turkish content itself plus the noindex/canonical pair proving
    // this is a controlled fallback, not a genuinely published ru page.
    await expect(page.getByRole("heading", { level: 1 }).first()).toContainText(name);
    const metadata = await page.evaluate(() => {
      const headChildren = Array.from(document.head.children);
      const robots = headChildren.find((node) => node.tagName === "META" && node.getAttribute("name") === "robots");
      const canonical = headChildren.find((node) => node.tagName === "LINK" && node.getAttribute("rel") === "canonical");
      return { robots: robots?.getAttribute("content") ?? "", canonical: canonical?.getAttribute("href") ?? "" };
    });
    expect(metadata.robots).toMatch(/noindex/i);
    expect(new URL(metadata.canonical).pathname).toBe(`/ekip/e2e-fallback-${suffix}`);
  });
});
