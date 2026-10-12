import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

/**
 * Images reach every browser (same origin, JPEG for browsers without WebP)
 * and the English site never shows the Turkish seed copy that Google
 * Translate cannot translate.
 */

const OLD_SAFARI_ACCEPT = "image/png,image/svg+xml,image/*;q=0.8,video/*;q=0.8,*/*;q=0.5";
const TURKISH_BOARD_TITLES = ["Yönetim Kurulu Başkanı", "Başkan Yardımcısı", "Yönetim Kurulu Üyesi"];

test("public images are served from our own origin and all load", async ({ page }) => {
  for (const path of ["/", "/board", "/gallery", "/news"]) {
    await page.goto(path);
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 500) {
        window.scrollTo(0, y);
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    });
    const images = page.locator("main img, .kadik-hero, .kadik-banner");
    await expect(images.first()).toBeVisible();
    // Google Translate's own widget icons are not site content.
    const sources = await page.$$eval("main img", (nodes) => nodes.map((node) => node.getAttribute("src") ?? ""));
    expect(sources.filter((src) => /^https?:\/\//.test(src)), path).toEqual([]);
    await expect
      .poll(() => page.$$eval("main img", (nodes) => (nodes as HTMLImageElement[]).filter((node) => !(node.complete && node.naturalWidth > 0)).length), { message: path })
      .toBe(0);
  }
});

test("a browser without WebP support gets a JPEG", async ({ request }) => {
  const url = "/_next/image?url=%2Fkadik%2Fis-galeri-1.webp&w=640&q=75";
  const modern = await request.get(url, { headers: { accept: "image/avif,image/webp,*/*" } });
  expect(modern.headers()["content-type"]).toBe("image/webp");
  const legacy = await request.get(url, { headers: { accept: OLD_SAFARI_ACCEPT } });
  expect(legacy.status()).toBe(200);
  expect(legacy.headers()["content-type"]).toBe("image/jpeg");
});

test("board titles on the English site are English", async ({ page }) => {
  await page.goto("/board");
  const roles = await page.locator(".kadik-board-card span").allInnerTexts();
  test.skip(roles.length === 0, "no published board members");
  const turkish = roles.filter((role) => TURKISH_BOARD_TITLES.some((title) => role.toLowerCase() === title.toLocaleLowerCase("tr")));
  expect(turkish).toEqual([]);
});

test("an article's old Turkish address redirects to its English slug", async ({ request }) => {
  const prisma = new PrismaClient();
  try {
    const turkish = await prisma.contentRoute.findMany({
      where: { contentType: "post", locale: "tr", translation: { publishedRevisionId: { not: null } } },
      select: { entityId: true, slug: true },
    });
    const english = await prisma.contentRoute.findMany({
      where: { contentType: "post", locale: "en", entityId: { in: turkish.map((row) => row.entityId) }, translation: { publishedRevisionId: { not: null } } },
      select: { entityId: true, slug: true },
    });
    const pair = turkish
      .map((tr) => ({ tr: tr.slug, en: english.find((en) => en.entityId === tr.entityId)?.slug }))
      .find((row) => row.en && row.en !== row.tr);
    test.skip(!pair, "no article with a separate English slug");
    const response = await request.get(`/news/${pair!.tr}`, { maxRedirects: 0 });
    expect(response.status()).toBe(308);
    expect(response.headers()["location"]).toBe(`/news/${pair!.en}`);
  } finally {
    await prisma.$disconnect();
  }
});
