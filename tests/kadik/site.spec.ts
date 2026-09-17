import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";

const routes = [
  ["/", "Değişim için"], ["/hakkimizda", "Hakkımızda"], ["/etkinlikler", "Etkinlikler"],
  ["/gonulluluk", "Gönüllülük"], ["/duyurular", "Duyurular"], ["/yazilar", "Yazılar"],
  ["/what-are-the-most-successful-methods-to-fight-against-tax-scam", "Vergi dolandırıcılığı"],
  ["/yazilar/vergi-dolandiriciligiyla-mucadelede-en-basarili-yontemler-nelerdir", "Vergi dolandırıcılığı"],
  ["/iletisim", "İletişim"], ["/galeri", "Galeri"],
  ["/gizlilik-politikasi", "Gizlilik Politikası"], ["/kullanim-sartlari", "Kullanım Koşulları"],
];

function errorsOn(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("response", (response) => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
  return errors;
}

async function login(page: Page) {
  await page.goto("/manage/login");
  await page.getByLabel("E-posta", { exact: true }).fill(process.env.ADMIN_EMAIL!);
  await page.getByLabel("Şifre", { exact: true }).fill(process.env.ADMIN_PASSWORD!);
  await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
  await expect(page).toHaveURL(/\/manage$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
}

for (const [route, heading] of routes) test(`public ${route}`, async ({ page }, info) => {
  const errors = errorsOn(page);
  const response = await page.goto(route);
  expect(response?.status()).toBe(200);
  await expect(page.locator("h1")).toContainText(heading);
  await expect(page).toHaveTitle(/\| KADIK$/);
  await page.evaluate(() => document.fonts.ready);
  expect(await page.locator("html").getAttribute("lang")).toBe("tr");
  expect(await page.locator(".kadik-header").evaluate((el) => getComputedStyle(el).position)).toBe("relative");
  await page.evaluate(async () => {
    for (const img of Array.from(document.images)) { if (!img.complete) await new Promise<void>((resolve) => { img.onload = () => resolve(); img.onerror = () => resolve(); }); }
  });
  const broken = await page.locator("img").evaluateAll((images) => images.filter((node) => !(node as HTMLImageElement).naturalWidth).map((node) => (node as HTMLImageElement).src));
  expect(broken).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  if (route !== "/etkinlikler") await expect(page.locator("[data-motion]").first()).toBeAttached();
  // Scroll in steps so reveal and image loading are exercised, not bypassed.
  for (let y = 0, height = await page.evaluate(() => document.body.scrollHeight); y < height; y += 550) {
    await page.evaluate((top) => window.scrollTo(0, top), y);
    await page.waitForTimeout(150);
  }
  await page.waitForTimeout(950);
  await expect(page.locator('[data-motion-state="pending"]')).toHaveCount(0);
  await page.screenshot({ path: info.outputPath("full-page.png"), fullPage: true });
  expect(errors).toEqual([]);
});

test("navigation, category query and search", async ({ page }, info) => {
  const errors = errorsOn(page);
  await page.goto("/");
  if (info.project.name === "mobile") {
    await page.getByRole("button", { name: "Menüyü aç" }).click();
    const mobileNav = page.getByRole("navigation", { name: "Mobil menü" });
    await expect(mobileNav.getByRole("link", { name: "Hizmetler", exact: true })).toBeVisible();
    await expect(mobileNav.getByRole("link", { name: "Etkinlikler", exact: true })).toBeVisible();
    await expect(mobileNav.getByRole("link", { name: "Gönüllülük", exact: true })).toBeVisible();
    await expect(mobileNav.getByRole("link", { name: "Duyurular", exact: true })).toBeVisible();
    await mobileNav.getByRole("link", { name: "Makaleler", exact: true }).click();
  } else {
    const mainNav = page.getByRole("navigation", { name: "Ana menü" });
    await mainNav.getByRole("link", { name: "Hizmetler", exact: true }).hover();
    await expect(mainNav.getByRole("link", { name: "Etkinlikler", exact: true })).toBeVisible();
    await expect(mainNav.getByRole("link", { name: "Gönüllülük", exact: true })).toBeVisible();
    await expect(mainNav.getByRole("link", { name: "Duyurular", exact: true })).toBeVisible();
    await expect(page.locator(".kadik-header-inner > .kadik-button")).toHaveCount(0);
    await mainNav.getByRole("link", { name: "Yazılar", exact: true }).hover();
    await mainNav.getByRole("link", { name: "Makaleler", exact: true }).click();
  }
  await expect(page.locator(".kadik-filter-row button[aria-pressed=true]")).toHaveText("Makale");
  await expect(page.locator(".kadik-post-card")).toHaveCount(1);
  await page.getByRole("button", { name: "Haber", exact: true }).click();
  await expect(page.locator(".kadik-post-card")).toHaveCount(2);
  await page.reload();
  await expect(page.locator(".kadik-filter-row button[aria-pressed=true]")).toHaveText("Haber");
  await page.getByLabel("Yazılarda ara").fill("bulunamayacakbaşlık");
  await expect(page.getByRole("status")).toContainText("bulunamadı");
  expect(errors).toEqual([]);
});

test("gallery filter, modal, Escape and focus return", async ({ page }) => {
  const errors = errorsOn(page);
  await page.goto("/galeri");
  await page.locator(".kadik-gallery-filter").getByRole("button", { name: "Gönüllüler" }).click();
  await expect(page.locator(".kadik-gallery-grid > button")).toHaveCount(3);
  const trigger = page.locator(".kadik-gallery-grid > button").first();
  await trigger.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(trigger).toBeFocused();
  expect(errors).toEqual([]);
});

test("calendar months, list and search", async ({ page }) => {
  const errors = errorsOn(page);
  await page.goto("/etkinlikler");
  await expect(page.locator(".kadik-days > div")).toHaveCount(35);
  await page.getByRole("button", { name: "Sonraki ay" }).click();
  await expect(page.locator(".kadik-calendar-head strong")).toHaveText("Ekim 2026");
  await page.getByRole("button", { name: "Önceki ay" }).click();
  await page.getByRole("button", { name: "Liste", exact: true }).click();
  await expect(page.locator(".kadik-event-list article")).toHaveCount(4);
  await page.getByLabel("Etkinliklerde ara").fill("Mahalle");
  await page.getByRole("button", { name: "Etkinlik bul" }).click();
  await expect(page.locator(".kadik-event-list article")).toHaveCount(1);
  expect(errors).toEqual([]);
});

test("scroll reveal and reduced motion", async ({ page }) => {
  await page.goto("/");
  const card = page.locator(".kadik-principle-card").first();
  await expect(card).toHaveAttribute("data-motion-state", "pending");
  await expect(card).toHaveCSS("opacity", "0");
  await card.scrollIntoViewIfNeeded();
  await expect(card).toHaveAttribute("data-motion-state", "visible");
  await expect(card).toHaveCSS("opacity", "1");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  await expect(card).toHaveCSS("opacity", "1");
  await expect(card).toHaveCSS("transform", "none");
  await expect(card).toHaveCSS("transition-duration", "0s");
});

test("admin login, every navigation route and logout", async ({ page }, info) => {
  test.setTimeout(150000);
  const errors = errorsOn(page);
  await page.goto("/manage/users");
  await expect(page).toHaveURL(/\/manage\/login$/);
  await page.getByLabel("E-posta", { exact: true }).fill(process.env.ADMIN_EMAIL!);
  await page.getByLabel("Şifre", { exact: true }).fill("incorrect-password-for-qa");
  await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
  await expect(page.locator("form").getByRole("alert")).toHaveText("E-posta veya şifre hatalı.");
  await expect(page).toHaveURL(/\/manage\/login$/);
  await login(page);
  const links = await page.locator('nav[aria-label="Yönetim navigasyonu"] a').evaluateAll((nodes) => nodes.map((node) => node.getAttribute("href")!));
  expect(links).toHaveLength(15);
  for (const route of links) {
    const response = await page.goto(route);
    expect(response?.status(), route).toBe(200);
    await expect(page.locator("h1"), route).toBeVisible();
    await expect(page).not.toHaveURL(/login/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), route).toBe(true);
  }
  await page.screenshot({ path: info.outputPath("admin-users.png"), fullPage: true });
  if (info.project.name === "mobile") await page.getByRole("button", { name: "Menüyü aç" }).click();
  await page.getByRole("button", { name: "Çıkış yap" }).click();
  await expect(page).toHaveURL(/\/manage\/login$/);
  expect(errors).toEqual([]);
});

test("forms persist, retry is idempotent, message appears in admin", async ({ page, request }, info) => {
  test.setTimeout(120000);
  const errors = errorsOn(page);
  const client = new PrismaClient();
  const email = `qa-${randomUUID()}@kadik.local`;
  try {
    for (const [route, compact, volunteer] of [["/iletisim", false, false], ["/gonulluluk", false, true], ["/", true, false]] as const) {
      await page.goto(route);
      if (!compact) await page.getByPlaceholder("Adınız Soyadınız").fill("KADIK QA");
      await page.getByPlaceholder("E-posta adresiniz").fill(email);
      if (!compact) await page.getByPlaceholder(volunteer ? "Bize kendinizden bahsedin" : "Mesajınız").fill(`QA ${info.project.name} ${route}`);
      if (volunteer) await page.locator("select[name=subject]").selectOption("Etkinlik düzenleme");
      await page.locator('input[name="consent"]').check();
      await page.locator(".kadik-form button[type=submit], .kadik-form button:not([type])").click();
      await expect(page.locator(".kadik-form-status")).toContainText("Mesajınız alındı");
      await expect(page.getByPlaceholder("E-posta adresiniz")).toHaveValue("");
    }
    await expect.poll(() => client.message.count({ where: { email } })).toBe(3);
    const payload = { name: "KADIK QA retry", email, message: "Same retry", consent: true };
    expect((await request.post("/api/kadik/contact", { data: payload })).status()).toBe(200);
    expect((await request.post("/api/kadik/contact", { data: payload })).status()).toBe(200);
    expect(await client.message.count({ where: { email } })).toBe(4);
    expect((await request.post("/api/kadik/contact", { data: { ...payload, consent: false } })).status()).toBe(400);
    await login(page);
    await page.goto("/manage/messages");
    await expect(page.getByRole("button", { name: "KADIK QA retry", exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    // Only rows belonging to this run's generated identifier are removed.
    await client.message.deleteMany({ where: { email } });
    await client.$disconnect();
  }
});

test("404 and API readiness", async ({ page, request }) => {
  const jsErrors: string[] = [];
  page.on("pageerror", (error) => jsErrors.push(error.message));
  const response = await page.goto("/bu-sayfa-yok/test");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Sayfa bulunamadı" })).toBeVisible();
  expect(jsErrors).toEqual([]);
  expect((await request.get("/api/kadik-api/ready")).status()).toBe(200);
});

test("content remains visible with JavaScript disabled", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("http://localhost:3901/");
  await expect(page.locator(".kadik-principle-card").first()).toHaveCSS("opacity", "1");
  await context.close();
});
