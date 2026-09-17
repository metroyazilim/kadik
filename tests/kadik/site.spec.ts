import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import {
  KADIK_DICT,
  KADIK_LOCALES,
  KADIK_PATHS,
  type KadikLocale,
  type KadikPageKey,
} from "../../lib/kadik-i18n";

type PublicPageKey = Exclude<KadikPageKey, "post" | "notfound">;

const publicPageKeys = [
  "home",
  "about",
  "board",
  "events",
  "membership",
  "issues",
  "posts",
  "contact",
  "gallery",
  "privacy",
  "terms",
] as const satisfies readonly PublicPageKey[];

function routeHeading(locale: KadikLocale, key: PublicPageKey): string {
  const t = KADIK_DICT[locale];
  switch (key) {
    case "home": return t.home.heroTitleLine1;
    case "about": return t.about.pageTitle;
    case "board": return t.board.pageTitle;
    case "events": return t.events.pageTitle;
    case "membership": return t.membership.pageTitle;
    case "issues": return t.announcements.pageTitle;
    case "posts": return t.news.pageTitle;
    case "contact": return t.contact.pageTitle;
    case "gallery": return t.gallery.pageTitle;
    case "privacy": return t.legal.privacyTitle;
    case "terms": return t.legal.termsTitle;
  }
}

const routes = KADIK_LOCALES.flatMap((locale) => publicPageKeys.map((key) => ({
  key,
  locale,
  route: KADIK_PATHS[key][locale],
  heading: routeHeading(locale, key),
})));

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

for (const { key, locale, route, heading } of routes) test(`public ${locale} ${route}`, async ({ page }, info) => {
  const errors = errorsOn(page);
  const response = await page.goto(route);
  expect(response?.status()).toBe(200);
  await expect(page.locator("h1")).toContainText(heading);
  await expect(page).toHaveTitle(/\| KADİK$|KADİK \| Kybele/);
  await page.evaluate(() => document.fonts.ready);
  expect(await page.locator("html").getAttribute("lang")).toBe(KADIK_DICT[locale].htmlLang);
  await expect(page.locator(".kadik-lang-switch")).toHaveText(locale === "en" ? "TR" : "EN");
  expect(await page.locator(".kadik-header").evaluate((el) => getComputedStyle(el).position)).toBe("relative");
  await page.evaluate(async () => {
    for (const img of Array.from(document.images)) { if (!img.complete) await new Promise<void>((resolve) => { img.onload = () => resolve(); img.onerror = () => resolve(); }); }
  });
  const broken = await page.locator("img").evaluateAll((images) => images.filter((node) => !(node as HTMLImageElement).naturalWidth).map((node) => (node as HTMLImageElement).src));
  expect(broken).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  if (key !== "events") await expect(page.locator("[data-motion]").first()).toBeAttached();
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
  await page.goto(KADIK_PATHS.home.en);
  if (info.project.name === "mobile") {
    await page.getByRole("button", { name: "Open menu" }).click();
    const mobileNav = page.getByRole("navigation", { name: "Mobile menu" });
    await expect(mobileNav.getByRole("link", { name: "Corporate", exact: true })).toBeVisible();
    await expect(mobileNav.getByRole("link", { name: "Board Members", exact: true })).toBeVisible();
    await expect(mobileNav.getByRole("link", { name: "Activities", exact: true })).toBeVisible();
    await expect(mobileNav.getByRole("link", { name: "Events", exact: true })).toBeVisible();
    await expect(mobileNav.getByRole("link", { name: "Announcements", exact: true })).toBeVisible();
    await expect(mobileNav.getByRole("link", { name: "Membership", exact: true })).toBeVisible();
    await mobileNav.getByRole("link", { name: "News", exact: true }).last().click();
  } else {
    const mainNav = page.getByRole("navigation", { name: "Main menu" });
    await mainNav.getByRole("link", { name: "Activities", exact: true }).hover();
    await expect(mainNav.getByRole("link", { name: "Events", exact: true })).toBeVisible();
    await expect(mainNav.getByRole("link", { name: "Announcements", exact: true })).toBeVisible();
    await expect(mainNav.getByRole("link", { name: "News", exact: true }).first()).toBeVisible();
    await expect(page.locator(".kadik-header-inner > .kadik-button")).toHaveCount(0);
    await mainNav.getByRole("link", { name: "News", exact: true }).last().click();
  }
  await expect(page).toHaveURL(KADIK_PATHS.posts.en);
  await expect(page.locator(".kadik-post-card")).toHaveCount(2);
  const enFilters = page.locator(".kadik-filter-row");
  await enFilters.getByRole("button", { name: "Article", exact: true }).click();
  await expect(page).toHaveURL(`${KADIK_PATHS.posts.en}?category=article`);
  await expect(enFilters.locator("button[aria-pressed=true]")).toHaveText("Article");
  await expect(page.locator(".kadik-post-card")).toHaveCount(1);
  await enFilters.getByRole("button", { name: "All", exact: true }).click();
  await expect(page).toHaveURL(KADIK_PATHS.posts.en);
  await expect(page.locator(".kadik-post-card")).toHaveCount(2);
  await enFilters.getByRole("button", { name: "News", exact: true }).click();
  await page.reload();
  await expect(page).toHaveURL(`${KADIK_PATHS.posts.en}?category=news`);
  await expect(page.locator(".kadik-filter-row button[aria-pressed=true]")).toHaveText("News");
  await page.getByLabel("Search news").fill("a-title-that-cannot-exist");
  await expect(page.getByRole("status")).toContainText("No article matches");

  await page.goto(KADIK_PATHS.posts.tr);
  const trFilters = page.locator(".kadik-filter-row");
  await trFilters.getByRole("button", { name: "Makale", exact: true }).click();
  await expect(page).toHaveURL(`${KADIK_PATHS.posts.tr}?category=makale`);
  await page.reload();
  await expect(page.locator(".kadik-filter-row button[aria-pressed=true]")).toHaveText("Makale");
  expect(errors).toEqual([]);
});

test("language switcher follows equivalent EN and TR routes", async ({ page }) => {
  await page.goto(KADIK_PATHS.about.en);
  const toTurkish = page.locator(".kadik-lang-switch");
  await expect(toTurkish).toHaveText("TR");
  await expect(toTurkish).toHaveAttribute("href", KADIK_PATHS.about.tr);
  await toTurkish.click();
  await expect(page).toHaveURL(KADIK_PATHS.about.tr);

  const toEnglish = page.locator(".kadik-lang-switch");
  await expect(toEnglish).toHaveText("EN");
  await expect(toEnglish).toHaveAttribute("href", KADIK_PATHS.about.en);
  await toEnglish.click();
  await expect(page).toHaveURL(KADIK_PATHS.about.en);
});

test("gallery filter, modal, Escape and focus return", async ({ page }) => {
  const errors = errorsOn(page);
  await page.goto(KADIK_PATHS.gallery.tr);
  await page.locator(".kadik-gallery-filter").getByRole("button", { name: "Toplantılar" }).click();
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
  await page.goto(KADIK_PATHS.events.tr);
  await expect(page.locator(".kadik-days > div")).toHaveCount(35);
  await page.getByRole("button", { name: "Sonraki ay" }).click();
  await expect(page.locator(".kadik-calendar-head strong")).toHaveText("Ekim 2026");
  await page.getByRole("button", { name: "Önceki ay" }).click();
  await page.getByRole("button", { name: "Liste", exact: true }).click();
  await expect(page.locator(".kadik-event-list article")).toHaveCount(4);
  await page.getByLabel("Etkinliklerde ara").fill("İhracat");
  await page.getByRole("button", { name: "Etkinlik bul" }).click();
  await expect(page.locator(".kadik-event-list article")).toHaveCount(1);
  expect(errors).toEqual([]);
});

test("scroll reveal and reduced motion", async ({ page }) => {
  await page.goto(KADIK_PATHS.home.en);
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
    await page.goto(KADIK_PATHS.contact.tr);
    await page.getByPlaceholder("Adınız Soyadınız").fill("KADIK QA");
    await page.getByPlaceholder("E-posta adresiniz").fill(email);
    await page.getByPlaceholder("Mesajınız").fill(`QA ${info.project.name} ${KADIK_PATHS.contact.tr}`);
    await page.locator('input[name="consent"]').check();
    await page.locator(".kadik-form button:not([type])").click();
    await expect(page.locator(".kadik-form-status")).toContainText("Mesajınız alındı");
    await expect(page.getByPlaceholder("E-posta adresiniz")).toHaveValue("");

    // Üyelik başvurusu: dropdown yok, şirket/sektör bilgisi serbest metin.
    await page.goto(KADIK_PATHS.membership.tr);
    await expect(page.locator("select")).toHaveCount(0);
    for (const [field, value] of [["name", "KADIK QA"], ["email", email], ["phone", "+90 555 000 00 00"], ["company", "QA Sanayi A.Ş."], ["position", "Genel Müdür"], ["sector", "Lojistik"], ["city", "İstanbul"]] as const) {
      await page.locator(`.kadik-form [name="${field}"]`).fill(value);
    }
    await page.locator('.kadik-form [name="message"]').fill(`QA ${info.project.name} ${KADIK_PATHS.membership.tr}`);
    await page.locator('input[name="consent"]').check();
    await page.locator(".kadik-form button:not([type])").click();
    await expect(page.locator(".kadik-form-status")).toContainText("Başvurunuz alındı");
    await expect.poll(() => client.message.findFirst({ where: { email, subject: { contains: "Üyelik başvurusu" } }, select: { subject: true } })).not.toBeNull();
    await expect.poll(() => client.message.count({ where: { email } })).toBe(2);
    const payload = { name: "KADIK QA retry", email, message: "Same retry", consent: true };
    expect((await request.post("/api/kadik/contact", { data: payload })).status()).toBe(200);
    expect((await request.post("/api/kadik/contact", { data: payload })).status()).toBe(200);
    expect(await client.message.count({ where: { email } })).toBe(3);
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

test("English and Turkish 404 shells link back into the site and API is ready", async ({ page, request }) => {
  const jsErrors: string[] = [];
  page.on("pageerror", (error) => jsErrors.push(error.message));

  const englishResponse = await page.goto("/this-page-does-not-exist/test");
  expect(englishResponse?.status()).toBe(404);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator("h1")).toContainText("Page Not Found");
  await expect(page.getByRole("heading", { level: 2, name: "We couldn't find that page." })).toBeVisible();
  await page.getByRole("navigation", { name: "Site sections" }).getByRole("link", { name: /Board Members/ }).click();
  await expect(page).toHaveURL(KADIK_PATHS.board.en);

  const turkishResponse = await page.goto("/tr/bu-sayfa-yok/test");
  expect(turkishResponse?.status()).toBe(404);
  await expect(page.locator("html")).toHaveAttribute("lang", "tr");
  await expect(page.locator("h1")).toContainText("Sayfa Bulunamadı");
  await expect(page.getByRole("heading", { level: 2, name: "Aradığınız sayfaya ulaşamadık." })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Site bölümleri" }).getByRole("link", { name: /Kurul Üyeleri/ })).toHaveAttribute("href", KADIK_PATHS.board.tr);
  expect(jsErrors).toEqual([]);
  expect((await request.get("/api/kadik-api/ready")).status()).toBe(200);
});

test("published board members and posts reach both public locales", async ({ page }) => {
  const errors = errorsOn(page);
  for (const locale of KADIK_LOCALES) {
    await page.goto(KADIK_PATHS.board[locale]);
    const boardCards = page.locator(".kadik-board-card");
    await expect(boardCards).toHaveCount(6);
    await expect(boardCards.first().locator("img")).toHaveJSProperty("complete", true);

    await page.goto(KADIK_PATHS.posts[locale]);
    const postCards = page.locator(".kadik-post-card");
    await expect(postCards).toHaveCount(2);
    const firstPost = postCards.first();
    const title = await firstPost.locator("h3").innerText();
    await firstPost.locator("a").click();
    expect(new URL(page.url()).pathname).toMatch(new RegExp(`^${KADIK_PATHS.posts[locale]}/[^/]+$`));
    await expect(page.locator("h1")).toContainText(title);
    await expect(page.locator(".kadik-article-meta")).toContainText("KADİK");
  }
  expect(errors).toEqual([]);
});

test("legacy Turkish and volunteer addresses redirect to /tr routes", async ({ page, request }) => {
  for (const key of publicPageKeys.filter((pageKey) => pageKey !== "home")) {
    const destination = KADIK_PATHS[key].tr;
    const source = destination.slice("/tr".length);
    const redirect = await request.get(source, { maxRedirects: 0 });
    expect(redirect.status(), source).toBe(308);
    expect(new URL(redirect.headers().location!, "http://localhost:3901").pathname, source).toBe(destination);
  }

  const volunteerRedirect = await request.get("/gonulluluk", { maxRedirects: 0 });
  expect(volunteerRedirect.status()).toBe(308);
  expect(new URL(volunteerRedirect.headers().location!, "http://localhost:3901").pathname).toBe(KADIK_PATHS.membership.tr);

  const response = await page.goto("/gonulluluk");
  expect(response?.status()).toBe(200);
  await expect(page).toHaveURL(KADIK_PATHS.membership.tr);
  await expect(page.locator("h1")).toContainText(KADIK_DICT.tr.membership.pageTitle);
});

test("content remains visible with JavaScript disabled", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(`http://localhost:3901${KADIK_PATHS.home.en}`);
  await expect(page.locator(".kadik-principle-card").first()).toHaveCSS("opacity", "1");
  await context.close();
});
