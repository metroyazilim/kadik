// Pure merge layer between published site-settings (Story 6.1) and the
// checked-in dictionary the public shell (SiteHeader/Footer/MobileMenu)
// rendered exclusively before this correction. No I/O, no Prisma - this
// module is unit-testable without a database, so the "settings missing/
// empty field -> unchanged dictionary behaviour" contract can be proven
// without touching a live database (see tests/unit/story-6-1-public-shell-view.spec.ts).
//
// `SiteHeader`/`Footer` both call `buildSiteShellView` with the *same*
// `PublicSiteSettings | null` value (fetched once per request via the
// `cache()`-wrapped `getPublicSiteSettings`, see site-settings.ts) so the
// header and footer of a single page render never disagree about which
// nav/brand/contact/CTA is live.
import { CONTACT } from "../contact";
import type { Locale } from "../i18n/config";
import { isStaticPageKey, staticPath, type NavKey } from "../i18n/static-pages";
import type { Dictionary, NavEntry } from "../i18n/types";
import { SERVICE_COLLECTION_SEGMENTS } from "../content-model/service-routes";
import { PRODUCT_COLLECTION_SEGMENTS } from "../content-model/product-routes";
import { PROJECT_COLLECTION_SEGMENTS } from "../content-model/project-routes";
import { TEAM_COLLECTION_SEGMENTS } from "../content-model/team-routes";
import { POST_COLLECTION_SEGMENTS } from "../content-model/post-routes";
import type { PublicSiteSettings } from "./site-settings";

export type ShellLink = Readonly<{ label: string; href: string; external: boolean }>;
export type ShellNavItem = Readonly<{ label: string; href: string; external: boolean; children: readonly ShellLink[] }>;
export type ShellFooterColumn = Readonly<{ id: string; title: string; links: readonly ShellLink[] }>;

export type SiteShellView = Readonly<{
  /** `null` -> render the default two-tone "Starter Kurumsal" wordmark unchanged. */
  brandName: string | null;
  /** `null` -> no settings-provided logo (either none published, or it resolved to the shared placeholder). */
  logo: PublicSiteSettings["brand"]["logo"] | null;
  nav: readonly ShellNavItem[];
  cta: Readonly<{ label: string; href: string; external: boolean }>;
  contact: Readonly<{ email: string; emailHref: string; phone: string; phoneHref: string; address: string | null }>;
  /** `null` -> render the dictionary-driven "Quick Links" footer column unchanged. */
  footerColumns: readonly ShellFooterColumn[] | null;
  /** `null` -> render the dictionary's own footer summary text unchanged. */
  footerSummary: string | null;
}>;

/** Every internal href in this app is site-relative (`/en/...`, `#services`); only a settings-authored value can ever be an absolute `http(s)://` address. */
export function isExternalHref(href: string): boolean {
  return /^https?:\/\//i.test(href);
}

function toLink(label: string, href: string): ShellLink {
  return { label, href, external: isExternalHref(href) };
}

/** The five collection keys' native-script segments come straight from
 * their own `lib/content-model/*-routes.ts` source of truth (already AD-6
 * correct) - never duplicated as literals here. */

export function pathForNavKey(locale: Locale, key: NavKey): string {
  if (isStaticPageKey(key)) return staticPath(locale, key);
  const segment = {
    services: SERVICE_COLLECTION_SEGMENTS,
    products: PRODUCT_COLLECTION_SEGMENTS,
    projects: PROJECT_COLLECTION_SEGMENTS,
    team: TEAM_COLLECTION_SEGMENTS,
    blog: POST_COLLECTION_SEGMENTS,
  }[key][locale];
  return locale === "tr" ? `/${segment}` : `/${locale}/${segment}`;
}

function resolveDictNav(nav: readonly NavEntry[], locale: Locale): readonly ShellNavItem[] {
  return nav.map((item) => ({
    label: item.label,
    href: pathForNavKey(locale, item.href),
    external: false,
    children: (item.children ?? []).map((child) => toLink(child.label, pathForNavKey(locale, child.href))),
  }));
}

/**
 * `settings === null` means no site-settings projection exists for any
 * locale yet (Story 5.1/AD-5's global-empty case) - every field of the
 * returned view is then the exact, unmodified dictionary/legacy default,
 * never a broken or half-populated shell. Once settings exist, each field
 * still falls back independently when its own value is empty/null - an
 * admin who never touched navigation, for example, must not zero out the
 * public nav bar just because the CTA was published.
 */
export function buildSiteShellView(
  settings: PublicSiteSettings | null,
  dict: Dictionary,
  locale: Locale,
): SiteShellView {
  const defaultCta = { label: dict.common.getQuote, href: staticPath(locale, "contact"), external: false };
  const defaultContact = {
    email: CONTACT.email,
    emailHref: CONTACT.emailHref,
    phone: CONTACT.phone,
    phoneHref: CONTACT.phoneHref,
    address: null as string | null,
  };

  if (!settings) {
    return {
      brandName: null,
      logo: null,
      nav: resolveDictNav(dict.nav, locale),
      cta: defaultCta,
      contact: defaultContact,
      footerColumns: null,
      footerSummary: null,
    };
  }

  const nav =
    settings.navigation.length > 0
      ? settings.navigation.map((item) => ({
          label: item.label,
          href: item.url,
          external: isExternalHref(item.url),
          children: item.children.map((child) => toLink(child.label, child.url)),
        }))
      : resolveDictNav(dict.nav, locale);

  const cta = settings.cta
    ? { label: settings.cta.label, href: settings.cta.url, external: isExternalHref(settings.cta.url) }
    : defaultCta;

  const email = settings.contact.email ?? defaultContact.email;
  const phone = settings.contact.phone ?? defaultContact.phone;

  const footerColumns =
    settings.footer.columns.length > 0
      ? settings.footer.columns.map((column) => ({
          id: column.id,
          title: column.title,
          links: column.links.map((link) => toLink(link.label, link.url)),
        }))
      : null;

  return {
    brandName: settings.brand.name.trim().length > 0 ? settings.brand.name : null,
    logo: settings.brand.logo.isFallback ? null : settings.brand.logo,
    nav,
    cta,
    contact: {
      email,
      emailHref: settings.contact.email ? `mailto:${settings.contact.email}` : defaultContact.emailHref,
      phone,
      phoneHref: `tel:${phone.replace(/[^\d+]/g, "")}`,
      address: settings.contact.address,
    },
    footerColumns,
    footerSummary: settings.footer.summary.trim().length > 0 ? settings.footer.summary : null,
  };
}
