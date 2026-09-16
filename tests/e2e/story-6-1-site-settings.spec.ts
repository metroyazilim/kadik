import { randomUUID } from "node:crypto";
import { expect, test } from "../support/merged-fixtures";

test.describe("Story 6.1 Site Settings - locale-aware draft/publish admin journey (AC-6.1-01..03)", () => {
  test.beforeEach(async ({ page, adminSeed }) => {
    await page.goto("/manage/login");
    await page.getByLabel("E-posta").fill(adminSeed.email);
    await page.getByLabel("Şifre").fill(adminSeed.password);
    await page.getByRole("button", { name: "Giriş yap" }).click();
    await page.waitForURL(/\/manage$/);
  });

  test("[P0] admin edits the Turkish brand name, saves a draft, and publishes it", async ({ page }) => {
    const brandName = `Metro ${randomUUID().slice(0, 8)}`;

    await page.goto("/manage/site-settings");
    await expect(page.getByRole("heading", { name: "Site Ayarları" })).toBeVisible();

    const brandField = page.getByLabel("Marka adı");
    await expect(brandField).toBeVisible({ timeout: 15_000 });
    await brandField.fill(brandName);
    await page.getByLabel("Footer özeti").fill("Metro footer summary.");
    await page.getByLabel("Misyon").fill("Metro mission statement.");
    await page.getByLabel("Vizyon").fill("Metro vision statement.");

    await expect(page.getByText("Kaydedilmemiş değişiklikler var")).toBeVisible();

    await page.getByRole("button", { name: "Taslağı kaydet" }).click();
    await expect(page.getByRole("status").filter({ hasText: "taslağı kaydedildi" })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Taslak", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Bu dili yayınla" }).click();
    await expect(page.getByRole("status").filter({ hasText: "yayınlandı" })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Yayında", { exact: true }).first()).toBeVisible();
  });

  test("[P1] switching to the English tab shows an independent 'missing' status until its own draft is saved", async ({ page }) => {
    await page.goto("/manage/site-settings?locale=en");
    await expect(page.getByLabel("Marka adı")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("link", { name: /EN/ })).toHaveAttribute("aria-current", "page");
  });
});
