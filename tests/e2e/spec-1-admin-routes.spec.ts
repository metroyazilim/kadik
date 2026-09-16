import type { Page } from "@playwright/test";
import { expect, test } from "../support/merged-fixtures";

// Spec 1 route contract: every admin screen is its own address (AC-1), the
// retired query-state addresses redirect to it (AC-2), the session gate
// covers the whole group (AC-5), and the rail marks the active route from
// the pathname alone (AC-9). These replace the former
// `story-1-2-unified-workspace.spec.ts`, which pinned the opposite
// contract (one route, `?panel=` state, drawer editing).

const PANEL_ROUTES = [
  { path: "/manage", heading: "Yönetim Paneli" },
  { path: "/manage/services", heading: "Hizmet Kataloğu" },
  { path: "/manage/products", heading: /Ürün/ },
  { path: "/manage/projects", heading: /Proje/ },
  { path: "/manage/team", heading: /Ekip/ },
  { path: "/manage/faq", heading: /Soru|SSS/ },
  { path: "/manage/posts", heading: /Yazı|Gönderi/ },
  { path: "/manage/media", heading: /Medya/ },
  { path: "/manage/messages", heading: /Kutu|Mesaj/ },
  { path: "/manage/home", heading: /Anasayfa/ },
  { path: "/manage/pages", heading: /Sayfa/ },
  { path: "/manage/site-settings", heading: /Ayar/ },
  { path: "/manage/seo", heading: /SEO/ },
  { path: "/manage/audit", heading: /Denetim|Audit/ },
] as const;

async function login(page: Page, adminSeed: { email: string; password: string }) {
  await page.goto("/manage/login");
  await page.getByLabel("E-posta").fill(adminSeed.email);
  await page.getByLabel("Şifre").fill(adminSeed.password);
  await page.getByRole("button", { name: "Giriş yap" }).click();
  await page.waitForURL(/\/manage$/);
}

test.describe("Spec 1 - admin route contract", () => {
  test("AC-5: every panel address requires a session and lands on the login screen without one", async ({ page }) => {
    await page.goto("/manage/posts");
    await expect(page).toHaveURL(/\/manage\/login/);
    await expect(page.getByRole("heading", { name: "Yönetim paneline giriş" })).toBeVisible();
  });

  test("AC-10: the login screen reports a wrong credential inside the form and issues no session", async ({ page }) => {
    await page.goto("/manage/login");
    await page.getByLabel("E-posta").fill("nobody@example.test");
    await page.getByLabel("Şifre").fill("definitely-not-the-password");
    await page.getByRole("button", { name: "Giriş yap" }).click();

    await expect(page.getByRole("alert").filter({ hasText: "hatalı" })).toBeVisible();
    await expect(page).toHaveURL(/\/manage\/login/);
    // Still gated: the failed attempt must not have created a session.
    await page.goto("/manage/services");
    await expect(page).toHaveURL(/\/manage\/login/);
  });

  test("AC-1: each panel renders standalone at its own address on a cold request", async ({ page, adminSeed }) => {
    await login(page, adminSeed);
    for (const route of PANEL_ROUTES) {
      await page.goto(route.path);
      await expect(page, `${route.path} must render itself, not redirect`).toHaveURL(
        new RegExp(`${route.path.replace(/\//g, "\\/")}$`),
      );
      await expect(page.getByRole("heading", { name: route.heading }).first()).toBeVisible();
      await expect(page.getByRole("banner")).toBeVisible();
    }
  });

  test("AC-2: retired query-state addresses redirect to the real routes", async ({ page, adminSeed }) => {
    await login(page, adminSeed);

    await page.goto("/manage?panel=services");
    await expect(page).toHaveURL(/\/manage\/services$/);

    await page.goto("/manage?panel=audit");
    await expect(page).toHaveURL(/\/manage\/audit$/);
  });

  test("AC-9: the rail marks the active route from the pathname and survives a hard reload", async ({ page, adminSeed }) => {
    await login(page, adminSeed);
    const nav = page.getByRole("navigation", { name: "Yönetim navigasyonu" });

    await nav.getByRole("link", { name: "Hizmetler" }).click();
    await page.waitForURL(/\/manage\/services$/);
    await expect(nav.getByRole("link", { name: "Hizmetler" })).toHaveAttribute("aria-current", "page");

    // A drawer-era highlight derived from a query param would be lost here;
    // a pathname-derived one is not.
    await page.reload();
    await expect(nav.getByRole("link", { name: "Hizmetler" })).toHaveAttribute("aria-current", "page");

    // A record's own editor address still highlights its section.
    await page.goto("/manage/services");
    const firstRow = page.getByRole("link", { name: /^\// }).first();
    if (await firstRow.count()) {
      await page.getByRole("link", { name: "Düzenle" }).first().click();
      await page.waitForURL(/\/manage\/services\/[^/?]+/);
      await expect(nav.getByRole("link", { name: "Hizmetler" })).toHaveAttribute("aria-current", "page");
    }
  });
});
