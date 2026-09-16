import { expect, test } from "@playwright/test";
import { CONTACT } from "../../lib/contact";
import { tr } from "../../lib/i18n/dictionaries/tr";
import { buildSiteShellView, isExternalHref } from "../../lib/public-content/site-shell-view";
import type { PublicSiteSettings } from "../../lib/public-content/site-settings";
import type { ResolvedPublicMedia } from "../../lib/content-model/public-media-resolver";

function fallbackLogo(): ResolvedPublicMedia {
  return {
    url: "data:image/svg+xml,placeholder",
    altText: "Görsel",
    caption: null,
    width: null,
    height: null,
    mimeType: "image/svg+xml",
    isFallback: true,
    kind: "image",
    originVerified: false,
  };
}

function realLogo(): ResolvedPublicMedia {
  return {
    url: "https://cdn.example.com/logo.png",
    altText: "Metro Yazılım logo",
    caption: null,
    width: 200,
    height: 40,
    mimeType: "image/png",
    isFallback: false,
    kind: "image",
    originVerified: true,
  };
}

function baseSettings(overrides: Partial<PublicSiteSettings> = {}): PublicSiteSettings {
  return {
    brand: { name: "Metro Yazılım", logo: fallbackLogo() },
    contact: { email: "hello@metro.test", phone: "+90 555 000 00 00", address: "İstanbul" },
    cta: { label: "Teklif Al", url: "/contact" },
    navigation: [{ id: "nav-1", label: "Hizmetler", url: "/servisler", children: [] }],
    footer: { summary: "Metro Yazılım footer summary.", columns: [{ id: "col-1", title: "Bağlantılar", links: [{ id: "l-1", label: "Hakkımızda", url: "/hakkimizda" }] }] },
    mission: "Mission",
    vision: "Vision",
    servedLocale: "tr",
    fallbackApplied: false,
    ...overrides,
  };
}

test.describe("AC-6.1 public shell - buildSiteShellView (no database)", () => {
  test("settings === null -> every field is the unmodified dictionary/legacy default", () => {
    const view = buildSiteShellView(null, tr, "tr");

    expect(view.brandName).toBeNull();
    expect(view.logo).toBeNull();
    expect(view.footerColumns).toBeNull();
    expect(view.footerSummary).toBeNull();
    expect(view.cta).toEqual({ label: tr.common.getQuote, href: "/iletisim", external: false });
    expect(view.contact).toEqual({
      email: CONTACT.email,
      emailHref: CONTACT.emailHref,
      phone: CONTACT.phone,
      phoneHref: CONTACT.phoneHref,
      address: null,
    });
    // Every dict.nav entry survives; Turkish resolves prefixless native paths (Spec 2).
    expect(view.nav.map((item) => item.label)).toEqual(tr.nav.map((item) => item.label));
    expect(view.nav[0]!.href).toBe("/");
    expect(view.nav[1]!.href).toBe("/hakkimizda");
  });

  test("published settings with real data override every field", () => {
    const view = buildSiteShellView(baseSettings({ brand: { name: "Metro Yazılım", logo: realLogo() } }), tr, "tr");

    expect(view.brandName).toBe("Metro Yazılım");
    expect(view.logo?.url).toBe("https://cdn.example.com/logo.png");
    expect(view.nav).toEqual([{ label: "Hizmetler", href: "/servisler", external: false, children: [] }]);
    expect(view.cta).toEqual({ label: "Teklif Al", href: "/contact", external: false });
    expect(view.contact.email).toBe("hello@metro.test");
    expect(view.contact.emailHref).toBe("mailto:hello@metro.test");
    expect(view.contact.address).toBe("İstanbul");
    expect(view.footerColumns).toEqual([{ id: "col-1", title: "Bağlantılar", links: [{ label: "Hakkımızda", href: "/hakkimizda", external: false }] }]);
    expect(view.footerSummary).toBe("Metro Yazılım footer summary.");
  });

  test("published settings with an empty navigation array still falls back to the dictionary nav, never an empty bar", () => {
    const view = buildSiteShellView(baseSettings({ navigation: [] }), tr, "tr");
    expect(view.nav.length).toBeGreaterThan(0);
    expect(view.nav.map((item) => item.label)).toEqual(tr.nav.map((item) => item.label));
  });

  test("published settings with zero footer columns still falls back to the dictionary Quick Links column", () => {
    const view = buildSiteShellView(baseSettings({ footer: { summary: "S", columns: [] } }), tr, "tr");
    expect(view.footerColumns).toBeNull();
  });

  test("cta === null in settings falls back to the dictionary get-quote default", () => {
    const view = buildSiteShellView(baseSettings({ cta: null }), tr, "tr");
    expect(view.cta).toEqual({ label: tr.common.getQuote, href: "/iletisim", external: false });
  });

  test("contact fields fall back independently per-field, not all-or-nothing", () => {
    const view = buildSiteShellView(baseSettings({ contact: { email: "only-email@metro.test", phone: null, address: null } }), tr, "tr");
    expect(view.contact.email).toBe("only-email@metro.test");
    expect(view.contact.phone).toBe(CONTACT.phone);
    expect(view.contact.address).toBeNull();
  });

  test("brand name is an empty/whitespace-only string -> falls back to the default wordmark, never a blank header", () => {
    const view = buildSiteShellView(baseSettings({ brand: { name: "   ", logo: fallbackLogo() } }), tr, "tr");
    expect(view.brandName).toBeNull();
  });

  test("a fallback-placeholder logo is never rendered as a real image", () => {
    const view = buildSiteShellView(baseSettings({ brand: { name: "Metro Yazılım", logo: fallbackLogo() } }), tr, "tr");
    expect(view.logo).toBeNull();
  });

  test("an absolute http(s) nav/CTA/footer URL is classified external; a site-relative one is not", () => {
    expect(isExternalHref("https://partner.example.com")).toBe(true);
    expect(isExternalHref("http://partner.example.com")).toBe(true);
    expect(isExternalHref("/en/services")).toBe(false);
    expect(isExternalHref("#services")).toBe(false);

    const view = buildSiteShellView(
      baseSettings({
        navigation: [{ id: "nav-1", label: "Partner", url: "https://partner.example.com", children: [] }],
        cta: { label: "External CTA", url: "https://partner.example.com/quote" },
        footer: {
          summary: "S",
          columns: [{ id: "col-1", title: "T", links: [{ id: "l-1", label: "Partner", url: "https://partner.example.com" }] }],
        },
      }),
      tr,
      "tr",
    );
    expect(view.nav[0]!.external).toBe(true);
    expect(view.cta.external).toBe(true);
    expect(view.footerColumns![0]!.links[0]!.external).toBe(true);
  });

  test("locale prefixing is applied per requested locale for the dictionary-fallback nav (en example)", () => {
    const view = buildSiteShellView(null, tr, "en");
    expect(view.cta.href).toBe("/en/contact");
    for (const item of view.nav) {
      if (item.href !== "#") expect(item.href.startsWith("/en")).toBe(true);
    }
  });
});
