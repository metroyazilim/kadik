import { expect, test } from "../support/merged-fixtures";

test.describe("Admin login entry point", () => {
  test("[P1] renders the admin sign-in form", async ({ page }) => {
    await page.goto("/manage/login");

    await expect(page.getByRole("heading", { name: "Yönetim paneli" })).toBeVisible();
    await expect(page.getByLabel("E-posta")).toHaveAttribute("type", "email");
    await expect(page.getByLabel("Şifre")).toHaveAttribute("type", "password");
    await expect(page.getByRole("button", { name: "Giriş yap" })).toBeVisible();
  });
});
