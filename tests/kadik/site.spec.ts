import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { KADIK_DICT, KADIK_PATHS, type KadikPageKey } from "../../lib/kadik-i18n";

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
  "charter",
] as const satisfies readonly PublicPageKey[];

const t = KADIK_DICT.en;

function routeHeading(key: PublicPageKey): string {
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
    case "privacy": return t.privacy.title;
    case "terms": return t.terms.title;
    case "charter": return t.charter.title;
  }
}

const routes = publicPageKeys.map((key) => ({
  key,
  route: KADIK_PATHS[key].en,
  heading: routeHeading(key),
}));

/** Every old Turkish-slug and campaign-era address that `next.config.ts`
 * permanently redirects to its English canonical route. */
const LEGACY_REDIRECTS = [
  { source: "/hakkimizda", key: "about" },
  { source: "/kurul-uyeleri", key: "board" },
  { source: "/etkinlikler", key: "events" },
  { source: "/uyelik", key: "membership" },
  { source: "/duyurular", key: "issues" },
  { source: "/yazilar", key: "posts" },
  { source: "/iletisim", key: "contact" },
  { source: "/galeri", key: "gallery" },
  { source: "/gizlilik-politikasi", key: "privacy" },
  { source: "/kullanim-sartlari", key: "terms" },
] as const satisfies readonly { source: string; key: PublicPageKey }[];

function errorsOn(page: Page) {
  const errors: string[] = [];
  // `google.com/sorry/...` is Google's own bot-rate-limit CAPTCHA redirect
  // for the translate widget script, occasionally triggered by this suite's
  // rapid page-to-page navigation hitting the same external endpoint - an
  // external service hiccup, not a defect in this app.
  const isGoogleRateLimitNoise = (text: string) => text.includes("google.com/sorry/");
  page.on("pageerror", (error) => { if (!isGoogleRateLimitNoise(error.message)) errors.push(error.message); });
  page.on("console", (message) => { if (message.type() === "error" && !isGoogleRateLimitNoise(message.text())) errors.push(message.text()); });
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

for (const { key, route, heading } of routes) test(`public ${route}`, async ({ page }, info) => {
  const errors = errorsOn(page);
  const response = await page.goto(route);
  expect(response?.status()).toBe(200);
  await expect(page.locator("h1")).toContainText(heading);
  await expect(page).toHaveTitle(key === "home" ? "KADİK London | Kybele Atasever World Business Council" : /\| KADİK$/);
  await page.evaluate(() => document.fonts.ready);
  expect(await page.locator("html").getAttribute("lang")).toBe(t.htmlLang);
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
    await expect(mobileNav.getByRole("link", { name: "Charter", exact: true })).toBeVisible();
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
    await mainNav.getByRole("link", { name: "Corporate", exact: true }).hover();
    await expect(mainNav.getByRole("link", { name: "About Us", exact: true })).toBeVisible();
    await expect(mainNav.getByRole("link", { name: "Board Members", exact: true })).toBeVisible();
    await expect(mainNav.getByRole("link", { name: "Contact", exact: true })).toBeVisible();
    await expect(mainNav.getByRole("link", { name: "Charter", exact: true })).toBeVisible();
    await expect(page.locator(".kadik-header-inner > .kadik-button")).toHaveCount(0);
    await mainNav.getByRole("link", { name: "News", exact: true }).last().click();
  }
  await expect(page).toHaveURL(KADIK_PATHS.posts.en);
  await expect(page.getByRole("link", { name: "Made by Metro Yazılım", exact: true })).toHaveAttribute("href", "https://www.metroyazilim.com");
  await expect(page.locator(".kadik-footer-bottom").getByRole("link", { name: "Charter", exact: true })).toHaveCount(0);
  await expect(page.locator(".kadik-post-card")).toHaveCount(2);
  const filters = page.locator(".kadik-filter-row");
  await filters.getByRole("button", { name: "Article", exact: true }).click();
  await expect(page).toHaveURL(`${KADIK_PATHS.posts.en}?category=article`);
  await expect(filters.locator("button[aria-pressed=true]")).toHaveText("Article");
  await expect(page.locator(".kadik-post-card")).toHaveCount(1);
  await filters.getByRole("button", { name: "All", exact: true }).click();
  await expect(page).toHaveURL(KADIK_PATHS.posts.en);
  await expect(page.locator(".kadik-post-card")).toHaveCount(2);
  await filters.getByRole("button", { name: "News", exact: true }).click();
  await page.reload();
  await expect(page).toHaveURL(`${KADIK_PATHS.posts.en}?category=news`);
  await expect(page.locator(".kadik-filter-row button[aria-pressed=true]")).toHaveText("News");
  await page.getByLabel("Search news").fill("a-title-that-cannot-exist");
  await expect(page.getByRole("status")).toContainText("No article matches");
  expect(errors).toEqual([]);
});

test("gallery filter, modal, Escape and focus return", async ({ page }) => {
  const errors = errorsOn(page);
  await page.goto(KADIK_PATHS.gallery.en);
  await page.locator(".kadik-gallery-filter").getByRole("button", { name: "Meetings" }).click();
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
  await page.goto(KADIK_PATHS.events.en);
  await expect(page.locator(".kadik-days > div")).toHaveCount(35);
  await page.getByRole("button", { name: "Next month" }).click();
  await expect(page.locator(".kadik-calendar-head strong")).toHaveText("October 2026");
  await page.getByRole("button", { name: "Previous month" }).click();
  await page.getByRole("button", { name: "List", exact: true }).click();
  await expect(page.locator(".kadik-event-list article")).toHaveCount(4);
  await page.getByLabel("Search events").fill("Export");
  await page.getByRole("button", { name: "Find event" }).click();
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
    await page.goto(KADIK_PATHS.contact.en);
    await page.getByPlaceholder(t.contactForm.namePlaceholder).fill("KADIK QA");
    await page.getByPlaceholder(t.contactForm.emailPlaceholder).fill(email);
    await page.getByPlaceholder(t.contactForm.messagePlaceholder).fill(`QA ${info.project.name} ${KADIK_PATHS.contact.en}`);
    await page.locator('input[name="consent"]').check();
    await page.locator(".kadik-form button:not([type])").click();
    await expect(page.locator(".kadik-form-status")).toContainText("Your message has been received");
    await expect(page.getByPlaceholder(t.contactForm.emailPlaceholder)).toHaveValue("");

    // No dropdown; company/sector are free text.
    await page.goto(KADIK_PATHS.membership.en);
    await expect(page.locator("select")).toHaveCount(0);
    for (const [field, value] of [["name", "KADIK QA"], ["email", email], ["phone", "+44 7000 000000"], ["company", "QA Industries Ltd"], ["position", "Managing Director"], ["sector", "Logistics"], ["city", "London"]] as const) {
      await page.locator(`.kadik-form [name="${field}"]`).fill(value);
    }
    await page.locator('.kadik-form [name="message"]').fill(`QA ${info.project.name} ${KADIK_PATHS.membership.en}`);
    await page.locator('input[name="consent"]').check();
    await page.locator(".kadik-form button:not([type])").click();
    await expect(page.locator(".kadik-form-status")).toContainText("Your application has been received");
    await expect.poll(() => client.message.findFirst({ where: { email, subject: { contains: "Membership application" } }, select: { subject: true } })).not.toBeNull();
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

test("404 shell links back into the site, legacy /tr paths are gone, and API is ready", async ({ page, request }) => {
  const jsErrors: string[] = [];
  page.on("pageerror", (error) => jsErrors.push(error.message));

  const response = await page.goto("/this-page-does-not-exist/test");
  expect(response?.status()).toBe(404);
  // No root `app/layout.tsx` exists (each route group brings its own); a
  // truly unmatched path falls through to a bare Next-synthesized
  // `<html>` with no `lang` attribute at all - the English text content
  // below is the real signal that no stale Turkish shell renders here.
  await expect(page.locator("h1")).toContainText("Page Not Found");
  await expect(page.getByRole("heading", { level: 2, name: "We couldn't find that page." })).toBeVisible();
  await page.getByRole("navigation", { name: "Site sections" }).getByRole("link", { name: /Board Members/ }).click();
  await expect(page).toHaveURL(KADIK_PATHS.board.en);

  // The removed `/tr/*` route tree falls through to the same English 404
  // shell - it never serves stale Turkish content.
  const legacyLocaleResponse = await page.goto("/tr/bu-sayfa-yok/test");
  expect(legacyLocaleResponse?.status()).toBe(404);
  await expect(page.locator("h1")).toContainText("Page Not Found");

  expect(jsErrors).toEqual([]);
  expect((await request.get("/api/kadik-api/ready")).status()).toBe(200);
});

test("published board members and posts reach the site", async ({ page }) => {
  const errors = errorsOn(page);
  await page.goto(KADIK_PATHS.board.en);
  const boardCards = page.locator(".kadik-board-card");
  await expect(boardCards).toHaveCount(6);
  await expect(boardCards.first().locator("img")).toHaveJSProperty("complete", true);

  await page.goto(KADIK_PATHS.posts.en);
  const postCards = page.locator(".kadik-post-card");
  await expect(postCards).toHaveCount(2);
  const firstPost = postCards.first();
  const title = await firstPost.locator("h3").innerText();
  await Promise.all([
    page.waitForURL(new RegExp(`^.*${KADIK_PATHS.posts.en}/[^/]+$`)),
    firstPost.locator("a").click(),
  ]);
  await expect(page.locator("h1")).toContainText(title);
  await expect(page.locator(".kadik-article-meta")).toContainText("KADİK");
  expect(errors).toEqual([]);
});

test("legacy Turkish and volunteer addresses redirect to their English routes", async ({ page, request }) => {
  for (const { source, key } of LEGACY_REDIRECTS) {
    const destination = KADIK_PATHS[key].en;
    const redirect = await request.get(source, { maxRedirects: 0 });
    expect(redirect.status(), source).toBe(308);
    expect(new URL(redirect.headers().location!, "http://localhost:3901").pathname, source).toBe(destination);
  }

  const volunteerRedirect = await request.get("/gonulluluk", { maxRedirects: 0 });
  expect(volunteerRedirect.status()).toBe(308);
  expect(new URL(volunteerRedirect.headers().location!, "http://localhost:3901").pathname).toBe(KADIK_PATHS.membership.en);

  const response = await page.goto("/gonulluluk");
  expect(response?.status()).toBe(200);
  await expect(page).toHaveURL(KADIK_PATHS.membership.en);
  await expect(page.locator("h1")).toContainText(t.membership.pageTitle);
});

test("content remains visible with JavaScript disabled", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(`http://localhost:3901${KADIK_PATHS.home.en}`);
  await expect(page.locator(".kadik-principle-card").first()).toHaveCSS("opacity", "1");
  await context.close();
});
