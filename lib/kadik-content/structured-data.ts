import "server-only";
import { SITE_URL } from "@/lib/i18n/config";
import { KADIK_PATHS, kadikPostPath, type KadikDictionary } from "@/lib/kadik-i18n";
import { stripHtmlToText } from "@/lib/content-model/sanitization";
import type { KadikEventView } from "./collection-types";
import { KADIK_PAGE_DEFINITIONS, type KadikContentKey, type KadikSeo } from "./pages";

/**
 * schema.org JSON-LD for the KADİK public site. Everything is derived from
 * content the admin panel already manages (Header & Footer → Kurum
 * bilgileri, İletişim, SEO, events, board members, news), so there is no
 * second copy of any fact to keep in sync.
 */

type Json = Record<string, unknown>;

const abs = (path: string) => (/^https?:\/\//i.test(path) ? path : new URL(path, SITE_URL).toString());
const ORG_ID = `${SITE_URL}/#organization`;
const SITE_ID = `${SITE_URL}/#website`;

function sameAs(dict: KadikDictionary): string[] {
  return Object.values(dict.footer.socials).filter((value) => /^https?:\/\//i.test(value));
}

export function organizationLd(dict: KadikDictionary): Json {
  const org = dict.organization;
  const email = dict.contact.email.trim();
  const phone = dict.contact.phone.trim();
  return {
    "@type": "Organization",
    "@id": ORG_ID,
    name: org.name,
    alternateName: org.alternateName || undefined,
    url: `${SITE_URL}/`,
    logo: { "@type": "ImageObject", url: abs("/kadik/kadik-logo.png"), width: 1254, height: 1254 },
    image: abs("/kadik/og/default.png"),
    description: org.description || undefined,
    foundingDate: org.foundingDate || undefined,
    email: email || undefined,
    telephone: phone || undefined,
    address: { "@type": "PostalAddress", addressLocality: org.locality || undefined, addressCountry: org.countryCode || undefined },
    contactPoint: email || phone ? [{ "@type": "ContactPoint", contactType: "customer support", email: email || undefined, telephone: phone || undefined, availableLanguage: ["English", "Turkish"] }] : undefined,
    sameAs: sameAs(dict).length ? sameAs(dict) : undefined,
  };
}

function websiteLd(dict: KadikDictionary): Json {
  return {
    "@type": "WebSite",
    "@id": SITE_ID,
    url: `${SITE_URL}/`,
    name: "KADİK London",
    alternateName: dict.organization.name,
    inLanguage: "en-GB",
    publisher: { "@id": ORG_ID },
  };
}

const PAGE_TYPES: Partial<Record<KadikContentKey, string>> = {
  about: "AboutPage",
  contact: "ContactPage",
  gallery: "CollectionPage",
  news: "CollectionPage",
  board: "CollectionPage",
  events: "CollectionPage",
};

function breadcrumbLd(dict: KadikDictionary, trail: readonly Readonly<{ name: string; path: string }>[]): Json {
  const items = [{ name: dict.nav.home, path: "/" }, ...trail];
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({ "@type": "ListItem", position: index + 1, name: item.name, item: abs(item.path) })),
  };
}

function webPageLd(key: KadikContentKey, dict: KadikDictionary, seo: KadikSeo, pageName: string): Json {
  const definition = KADIK_PAGE_DEFINITIONS[key];
  const path = definition.publicPath ?? "/";
  return {
    "@type": key === "home" ? "WebPage" : (PAGE_TYPES[key] ?? "WebPage"),
    "@id": `${abs(path)}#webpage`,
    url: abs(path),
    name: seo.title || definition.seoDefaults.title,
    description: seo.description || undefined,
    inLanguage: "en-GB",
    isPartOf: { "@id": SITE_ID },
    about: { "@id": ORG_ID },
    primaryImageOfPage: { "@type": "ImageObject", url: abs(seo.image?.url || definition.seoDefaults.image.url || "/kadik/og/default.png") },
    breadcrumb: key === "home" ? undefined : breadcrumbLd(dict, [{ name: pageName, path }]),
  };
}

export type KadikLdExtras = Readonly<{
  events?: readonly KadikEventView[];
  gallery?: readonly Readonly<{ image: string; caption: string }>[];
  members?: readonly Readonly<{ name: string; role: string; image: string }>[];
  posts?: readonly Readonly<{ slug: string; title: string }>[];
}>;

/** The full `@graph` for one KADİK page. */
export function kadikPageGraph(key: KadikContentKey, dict: KadikDictionary, seo: KadikSeo, extras: KadikLdExtras = {}): Json {
  const pageNames: Partial<Record<KadikContentKey, string>> = {
    about: dict.about.pageTitle,
    board: dict.board.pageTitle,
    events: dict.events.pageTitle,
    announcements: dict.announcements.pageTitle,
    news: dict.news.pageTitle,
    membership: dict.membership.pageTitle,
    gallery: dict.gallery.pageTitle,
    contact: dict.contact.pageTitle,
    privacy: dict.privacy.title,
    terms: dict.terms.title,
    charter: dict.charter.title,
  };
  const graph: Json[] = [organizationLd(dict), websiteLd(dict), webPageLd(key, dict, seo, pageNames[key] ?? dict.nav.home)];
  const eventsUrl = abs(KADIK_PATHS.events.en);

  if (extras.events?.length) {
    graph.push({
      "@type": "ItemList",
      name: dict.events.pageTitle,
      itemListElement: extras.events.map((event, index) => {
        const description = event.descriptionHtml ? stripHtmlToText(event.descriptionHtml).replace(/\s+/g, " ").trim().slice(0, 300) : undefined;
        return {
          "@type": "ListItem",
          position: index + 1,
          item: {
            "@type": "Event",
            name: event.title,
            startDate: event.startTime ? `${event.date}T${event.startTime}` : event.date,
            endDate: event.endTime ? `${event.date}T${event.endTime}` : undefined,
            description,
            eventStatus: "https://schema.org/EventScheduled",
            eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
            location: {
              "@type": "Place",
              name: event.location || dict.organization.eventVenue,
              address: { "@type": "PostalAddress", addressLocality: dict.organization.locality, addressCountry: dict.organization.countryCode },
            },
            organizer: { "@id": ORG_ID },
            image: abs("/kadik/og/events.png"),
            url: `${eventsUrl}?event=${encodeURIComponent(event.id)}`,
          },
        };
      }),
    });
  }

  if (extras.gallery?.length) {
    graph.push({
      "@type": "ImageGallery",
      name: dict.gallery.pageTitle,
      url: abs(KADIK_PATHS.gallery.en),
      image: extras.gallery.map((item) => ({ "@type": "ImageObject", contentUrl: abs(item.image), caption: item.caption || undefined })),
    });
  }

  if (extras.members?.length) {
    graph.push({
      "@type": "ItemList",
      name: dict.board.pageTitle,
      itemListElement: extras.members.map((member, index) => ({
        "@type": "ListItem",
        position: index + 1,
        item: { "@type": "Person", name: member.name, jobTitle: member.role || undefined, image: member.image ? abs(member.image) : undefined, memberOf: { "@id": ORG_ID } },
      })),
    });
  }

  if (extras.posts?.length) {
    graph.push({
      "@type": "ItemList",
      name: dict.news.pageTitle,
      itemListElement: extras.posts.map((post, index) => ({ "@type": "ListItem", position: index + 1, url: abs(kadikPostPath("en", post.slug)), name: post.title })),
    });
  }

  return { "@context": "https://schema.org", "@graph": graph };
}

/** NewsArticle graph for one news detail page. */
export function kadikArticleGraph(
  dict: KadikDictionary,
  post: Readonly<{ slug: string; title: string; description: string; image: string; publishedAt: Date; author: string; category: string }>,
): Json {
  const url = abs(kadikPostPath("en", post.slug));
  return {
    "@context": "https://schema.org",
    "@graph": [
      organizationLd(dict),
      websiteLd(dict),
      {
        "@type": "NewsArticle",
        "@id": `${url}#article`,
        mainEntityOfPage: url,
        headline: post.title.slice(0, 110),
        description: post.description || undefined,
        image: [abs(`${kadikPostPath("en", post.slug)}/opengraph-image`), ...(post.image ? [abs(post.image)] : [])],
        datePublished: post.publishedAt.toISOString(),
        dateModified: post.publishedAt.toISOString(),
        articleSection: post.category || undefined,
        inLanguage: "en-GB",
        author: post.author ? { "@type": "Organization", name: post.author } : { "@id": ORG_ID },
        publisher: { "@id": ORG_ID },
        isPartOf: { "@id": SITE_ID },
      },
      breadcrumbLd(dict, [
        { name: dict.news.pageTitle, path: KADIK_PATHS.posts.en },
        { name: post.title, path: kadikPostPath("en", post.slug) },
      ]),
    ],
  };
}

/** Serialises JSON-LD safely for an inline <script> (no `</script>` break-out). */
export function jsonLdString(data: Json): string {
  return JSON.stringify(data, (_key, value) => (value === undefined ? undefined : value)).replace(/</g, "\\u003c");
}
