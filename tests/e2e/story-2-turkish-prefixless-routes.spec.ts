// Spec 2 - Turkish prefixless canonical routes and legacy redirects.
// Proves the real, wired route files against the running dev server: no
// CMS entities needed, these are pure route/redirect/nav/SEO-surface
// checks (the admin draft->publish->public flow itself stays covered by
// tests/e2e/story-3-1-service-crud.spec.ts, which already exercises
// /servisler/<slug> unaffected by this spec).
import { expect, test } from "@playwright/test";

test.describe("Spec 2 - Turkish home and static addresses render (AC-2.1, AC-2.2)", () => {
  test("[P0] GET / returns 200 and renders the Turkish home page with no redirect", async ({ page }) => {
    // AC-2.1 requires 200 + lang/dir + no redirect; unlike AC-2.2's seven
    // static pages, it does not require an <h1> - HomeComposed (untouched
    // by Spec 2, pre-existing) does not render one.
    const response = await page.goto("/");
    expect(response?.status()).toBe(200);
    expect(response?.request().redirectedFrom()).toBeNull();
    await expect(page.locator("html")).toHaveAttribute("lang", "tr");
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  });

  const staticPages: ReadonlyArray<readonly [string, string]> = [
    ["/hakkimizda", "Hakkımızda"],
    ["/iletisim", "İletişim"],
    ["/sss", "Sıkça Sorulan Sorular"],
    ["/arama", "Ara"],
    ["/misyon-ve-vizyon", "Misyon"],
    ["/kullanim-sartlari", "Kullanım Şartları"],
    ["/gizlilik-politikasi", "Gizlilik Politikası"],
  ];

  for (const [path] of staticPages) {
    test(`[P0] GET ${path} returns 200, one h1, lang=tr`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      await expect(page.locator("html")).toHaveAttribute("lang", "tr");
      await expect(page.locator("h1")).toHaveCount(1);
    });
  }
});

test.describe("Spec 2 - legacy /tr/* and /about permanently redirect (AC-2.3, AC-2.4)", () => {
  const rows: ReadonlyArray<readonly [string, string]> = [
    ["/tr", "/"],
    ["/about", "/hakkimizda"],
    ["/tr/about", "/hakkimizda"],
    ["/tr/contact", "/iletisim"],
    ["/tr/faq", "/sss"],
    ["/tr/search", "/arama"],
    ["/tr/mission-vision", "/misyon-ve-vizyon"],
    ["/tr/terms", "/kullanim-sartlari"],
    ["/tr/privacy", "/gizlilik-politikasi"],
    ["/tr/services", "/servisler"],
    ["/tr/products", "/urunler"],
    ["/tr/projects", "/projeler"],
    ["/tr/blog", "/blog"],
  ];

  for (const [source, destination] of rows) {
    test(`[P0] ${source} -> 308 -> ${destination}`, async ({ page }) => {
      const response = await page.request.get(source, { maxRedirects: 0 });
      expect(response.status()).toBe(308);
      expect(response.headers()["location"]).toBe(destination);

      // Following it lands on a real 200, not a further redirect loop.
      const followed = await page.goto(source);
      expect(followed?.status()).toBe(200);
      expect(new URL(page.url()).pathname).toBe(destination);
    });
  }

  test("[P0] an unmapped /tr/* address falls through the catch-all to a normal 404, never a rendered /tr page", async ({ page }) => {
    const response = await page.request.get("/tr/this-address-has-no-mapping", { maxRedirects: 0 });
    expect(response.status()).toBe(308);
    expect(response.headers()["location"]).toBe("/this-address-has-no-mapping");

    const followed = await page.goto("/tr/this-address-has-no-mapping");
    expect(followed?.status()).toBe(404);
  });
});

test.describe("Spec 2 - navigation is prefixless in Turkish, prefixed in English (AC-2.6)", () => {
  // Scoped to `header nav` (the registry-resolved primary menu) and the
  // footer's bottom terms/privacy links, which are unconditionally
  // registry-driven (`staticPath`/`pathForNavKey`, components/SiteHeader.tsx,
  // components/Footer.tsx). The header CTA and footer's admin-published
  // `footerColumns` are deliberately excluded: AC-2.7 lets a published
  // site-settings value be any admin-authored URL, internal or external.
  const NAV_SELECTOR = 'header nav a[href], footer .border-t a[href]';

  test("[P0] Turkish header/footer navigation carries no /tr/ href", async ({ page }) => {
    await page.goto("/");
    const hrefs = await page.locator(NAV_SELECTOR).evaluateAll((links) =>
      links.map((link) => link.getAttribute("href") ?? ""),
    );
    const internalHrefs = hrefs.filter((href) => href.startsWith("/"));
    expect(internalHrefs.length).toBeGreaterThan(0);
    for (const href of internalHrefs) expect(href.startsWith("/tr/")).toBe(false);
  });

  test("[P0] English header/footer navigation keeps its /en/ prefix", async ({ page }) => {
    await page.goto("/en");
    const hrefs = await page.locator(NAV_SELECTOR).evaluateAll((links) =>
      links.map((link) => link.getAttribute("href") ?? ""),
    );
    const internalHrefs = hrefs.filter((href) => href.startsWith("/") && href !== "/");
    expect(internalHrefs.length).toBeGreaterThan(0);
    for (const href of internalHrefs) expect(href.startsWith("/en")).toBe(true);
  });
});

test.describe("Spec 2 - canonical/hreflang correctness for static pages (AC-2.8)", () => {
  test("[P0] /hakkimizda emits Turkish and Global hreflang alternates with Turkish x-default", async ({ page }) => {
    await page.goto("/hakkimizda");
    const canonical = await page.locator('link[rel="canonical"]').getAttribute("href");
    expect(canonical).toMatch(/\/hakkimizda$/);
    expect(canonical).not.toContain("/tr/");

    const alternates = await page.locator('link[rel="alternate"][hreflang]').evaluateAll((links) =>
      links.map((link) => ({ hreflang: link.getAttribute("hreflang"), href: link.getAttribute("href") ?? "" })),
    );
    const byLang = Object.fromEntries(alternates.map((entry) => [entry.hreflang, entry.href]));
    expect(byLang["tr"]).toMatch(/\/hakkimizda$/);
    expect(byLang["en"]).toMatch(/\/en\/about$/);
    expect(byLang["x-default"]).toMatch(/\/hakkimizda$/);
    for (const href of Object.values(byLang)) expect(href).not.toContain("/tr/");
  });
});

test.describe("Spec 2 - sitemap and robots (AC-2.9)", () => {
  test("[P0] /sitemap.xml lists the prefixless Turkish static addresses and no /tr/ URL", async ({ page }) => {
    const response = await page.request.get("/sitemap.xml");
    expect(response.ok()).toBe(true);
    const body = await response.text();
    expect(body).toContain("<loc>http://localhost:3000/</loc>");
    expect(body).toContain("<loc>http://localhost:3000/hakkimizda</loc>");
    expect(body).toContain("<loc>http://localhost:3000/iletisim</loc>");
    expect(body).toContain("<loc>http://localhost:3000/en/about</loc>");
    expect(body).not.toContain("/tr/");
  });

  test("[P0] /robots.txt still disallows /manage and references the sitemap", async ({ page }) => {
    const response = await page.request.get("/robots.txt");
    expect(response.ok()).toBe(true);
    const body = await response.text();
    expect(body).toContain("Disallow: /manage");
    expect(body).toContain("/sitemap.xml");
  });
});

test.describe("Spec 2 - unsupported locale routes", () => {
  test("[P0] removed Russian and Arabic routes return not found while Global English remains live", async ({ page }) => {
    const english = await page.goto("/en/about");
    expect(english?.status()).toBe(200);
    await expect(page.locator("h1").first()).toBeVisible();

    for (const path of ["/ru/about", "/ar/about"]) {
      const response = await page.goto(path);
      expect(response?.status()).toBe(404);
    }
  });
});
