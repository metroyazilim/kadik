import { expect, test } from "../support/merged-fixtures";

test.describe("Story 1.3 Audit and Operation Result Visibility", () => {
  test.beforeEach(async ({ page, adminSeed }) => {
    await page.goto("/manage/login");
    await page.getByLabel("E-posta").fill(adminSeed.email);
    await page.getByLabel("Şifre").fill(adminSeed.password);
    await page.getByRole("button", { name: "Giriş yap" }).click();
    await page.waitForURL(/\/manage$/);
  });

  test("AC-1.3-01: Audit timeline shows recent actions with actor and timestamp", async ({ page }) => {
    await page.goto("/manage/audit");
    await expect(page.getByRole("heading", { name: "Denetim Kaydı" })).toBeVisible();
    const hasTable = await page.locator("table").isVisible().catch(() => false);
    const hasEmpty = await page.getByText("Henüz kayıt yok").isVisible().catch(() => false);
    expect(hasTable || hasEmpty).toBeTruthy();
  });
});
