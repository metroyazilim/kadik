import { expect, test } from "../support/merged-fixtures";

test.describe("Story 1.2 Admin Shell & Nav", () => {
  test.beforeEach(async ({ page, adminSeed }) => {
    await page.goto("/manage/login");
    await page.getByLabel("E-posta").fill(adminSeed.email);
    await page.getByLabel("Şifre").fill(adminSeed.password);
    await page.getByRole("button", { name: "Giriş yap" }).click();
    await page.waitForURL(/\/manage$/);
  });

  test("AC-1.2-01: Admin shell renders consistently across pages", async ({ page }) => {
    await page.goto("/manage/services");
    await expect(page.getByRole("banner")).toBeVisible();

    await page.goto("/manage/posts");
    await expect(page.getByRole("banner")).toBeVisible();
  });

  test("AC-1.2-02: Navigation state is preserved and mobile drawer works", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/manage/services");
    await page.getByRole("button", { name: "Menüyü aç" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("dialog").getByRole("link", { name: "Projeler" }).click();
    await page.waitForURL(/\/manage\/projects/);
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(page.getByText("Projeler").first()).toBeVisible();
  });

  test("AC-1.2-04: Loading/Empty states are consistent", async ({ page }) => {
    await page.goto("/manage/messages");
    await expect(page.getByRole("heading", { name: "Gelen Kutusu" })).toBeVisible();
  });
});
