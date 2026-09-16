import { expect, test } from "@playwright/test";
import {
  buildStaticRedirects,
  isStaticPageKey,
  STATIC_PAGE_KEYS,
  staticAlternates,
  staticPath,
} from "../../lib/i18n/static-pages";

test.describe("Spec 2 - static-page registry (AC-2.1..2.9)", () => {
  test("AC-2.5 - the key set is closed and exactly the eight documented pages", () => {
    expect(STATIC_PAGE_KEYS).toEqual([
      "home",
      "about",
      "contact",
      "faq",
      "search",
      "missionVision",
      "terms",
      "privacy",
    ]);
  });

  test("isStaticPageKey narrows correctly for both namespaces", () => {
    for (const key of STATIC_PAGE_KEYS) expect(isStaticPageKey(key)).toBe(true);
    expect(isStaticPageKey("services")).toBe(false);
    expect(isStaticPageKey("blog")).toBe(false);
  });

  test("AC-2.1, AC-2.2 - Turkish is prefixless, every other locale keeps its prefix", () => {
    expect(staticPath("tr", "home")).toBe("/");
    expect(staticPath("tr", "about")).toBe("/hakkimizda");
    expect(staticPath("tr", "contact")).toBe("/iletisim");
    expect(staticPath("tr", "faq")).toBe("/sss");
    expect(staticPath("tr", "search")).toBe("/arama");
    expect(staticPath("tr", "missionVision")).toBe("/misyon-ve-vizyon");
    expect(staticPath("tr", "terms")).toBe("/kullanim-sartlari");
    expect(staticPath("tr", "privacy")).toBe("/gizlilik-politikasi");

    expect(staticPath("en", "home")).toBe("/en");
    expect(staticPath("en", "about")).toBe("/en/about");
  });

  test("AC-2.8 - staticAlternates emits canonical tr/en hreflang entries and Turkish x-default", () => {
    const alt = staticAlternates("en", "about");
    expect(alt.canonical).toBe("http://localhost:3000/en/about");
    expect(alt.languages).toEqual({
      tr: "http://localhost:3000/hakkimizda",
      en: "http://localhost:3000/en/about",
      "x-default": "http://localhost:3000/hakkimizda",
    });
    for (const url of Object.values(alt.languages)) expect(url).not.toContain("/tr/");
  });

  test("AC-2.3, AC-2.4, AC-2.5 - the redirect table is generated, specific rows precede the catch-all, and no target contains a live /tr/ address", () => {
    const rows = buildStaticRedirects();
    expect(rows.every((row) => row.permanent)).toBe(true);

    const bySource: Record<string, string> = Object.fromEntries(rows.map((row) => [row.source, row.destination]));
    expect(bySource["/tr"]).toBe("/");
    expect(bySource["/about"]).toBe("/hakkimizda");
    expect(bySource["/tr/about"]).toBe("/hakkimizda");
    expect(bySource["/tr/contact"]).toBe("/iletisim");
    expect(bySource["/tr/faq"]).toBe("/sss");
    expect(bySource["/tr/search"]).toBe("/arama");
    expect(bySource["/tr/mission-vision"]).toBe("/misyon-ve-vizyon");
    expect(bySource["/tr/terms"]).toBe("/kullanim-sartlari");
    expect(bySource["/tr/privacy"]).toBe("/gizlilik-politikasi");
    expect(bySource["/tr/services"]).toBe("/servisler");
    expect(bySource["/tr/services/:slug"]).toBe("/servisler/:slug");
    expect(bySource["/tr/products"]).toBe("/urunler");
    expect(bySource["/tr/products/:slug"]).toBe("/urunler/:slug");
    expect(bySource["/tr/projects"]).toBe("/projeler");
    expect(bySource["/tr/projects/:slug"]).toBe("/projeler/:slug");
    expect(bySource["/tr/team/:slug"]).toBe("/ekip/:slug");
    expect(bySource["/tr/blog"]).toBe("/blog");
    expect(bySource["/tr/blog/:slug"]).toBe("/blog/:slug");
    expect(bySource["/tr/:path*"]).toBe("/:path*");

    // No destination ever routes back through a /tr/ address.
    for (const destination of Object.values(bySource)) expect(destination.startsWith("/tr/")).toBe(false);

    // The catch-all is last so every specific translation is checked first.
    expect(rows[rows.length - 1]!.source).toBe("/tr/:path*");
  });
});
