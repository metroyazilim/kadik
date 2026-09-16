import type { ContentLocale } from "@prisma/client";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import Footer from "@/components/Footer";
import { IconEnvelope, IconInstagram, IconLinkedin, IconPhone } from "@/components/Icon";
import ScrollToTop from "@/components/ScrollToTop";
import PageBanner from "@/components/PageBanner";
import Reveal from "@/components/Reveal";
import SiteHeader from "@/components/SiteHeader";
import { getPublicDictionary } from "@/lib/content";
import type { FallbackResolution } from "@/lib/content-model/route-registry";
import { TEAM_COLLECTION_SEGMENTS } from "@/lib/content-model/team-routes";
import { composeSeoMetadata, buildHreflangAlternates } from "@/lib/content-model/public-seo";
import { getSiteSeoDefaults } from "@/lib/content-model/site-seo-defaults";
import { resolveFallbackAliasRedirect } from "@/lib/content-model/public-seo-redirect";
import { prisma } from "@/lib/db";
import { SITE_URL, type Locale } from "@/lib/i18n/config";
import { staticPath } from "@/lib/i18n/static-pages";
import { getPublishedTeamMemberByRoute, getTeamMemberAlternates } from "@/lib/public-content/team";

/** Reused by app/manage/seo/SeoAuditPanel.tsx to compute the same fallback description the public page itself renders. */
export function descriptionOf(bio: string): string {
  const compact = bio.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return compact.length > 160 ? `${compact.slice(0, 157).trimEnd()}…` : compact;
}

/**
 * Spec 2 correction: both used to hand-build their target (`/tr/about` was
 * About's real, direct address before the cutover); `staticPath` is now the
 * one place that knows Turkish is prefixless and every other locale keeps
 * its `/<locale>` prefix, so a future segment change can never leave one of
 * these two out of sync with it again.
 */
function homeHref(locale: ContentLocale): string {
  return staticPath(locale as Locale, "home");
}

function aboutHref(locale: ContentLocale): string {
  return staticPath(locale as Locale, "about");
}

export async function generateTeamMemberMetadata(locale: ContentLocale, slug: string): Promise<Metadata> {
  const member = await getPublishedTeamMemberByRoute(locale, slug);
  if (!member) return {};

  const [alternateRoutes, defaults] = await Promise.all([
    getTeamMemberAlternates(member.entityId),
    getSiteSeoDefaults(prisma, locale),
  ]);
  const nativeUrlsByLocale = new Map(
    Object.entries(alternateRoutes).filter((entry): entry is [ContentLocale, string] => Boolean(entry[1])),
  );
  const languages: Record<string, string> = {};
  for (const alternate of buildHreflangAlternates(nativeUrlsByLocale)) {
    languages[alternate.locale] = `${SITE_URL}${alternate.url}`;
  }
  if (alternateRoutes.tr) languages["x-default"] = `${SITE_URL}${alternateRoutes.tr}`;

  const canonical = `${SITE_URL}${member.canonicalUrl}`;
  const route: FallbackResolution = member.noindex
    ? { kind: "fallback", url: canonical, canonical, noindex: true }
    : { kind: "native", url: canonical };
  const seo = composeSeoMetadata(
    route,
    {
      title: member.seoTitle ?? member.name,
      description: member.seoDescription ?? descriptionOf(member.bio),
      ogImageUrl: member.image.isFallback ? undefined : member.image.url,
    },
    defaults,
  );
  if (!seo) return {};

  return {
    title: seo.title,
    description: seo.description,
    alternates: { canonical: seo.canonical, languages },
    robots: seo.robots,
    openGraph: {
      title: seo.title,
      description: seo.description,
      ...(seo.ogTags.image ? { images: [seo.ogTags.image] } : {}),
    },
  };
}

export async function TeamMemberDetail({ locale, slug }: { locale: ContentLocale; slug: string }) {
  const [dict, member] = await Promise.all([getPublicDictionary(locale as Locale), getPublishedTeamMemberByRoute(locale, slug)]);
  if (!member) {
    const legacy = await resolveFallbackAliasRedirect(prisma, locale, TEAM_COLLECTION_SEGMENTS[locale], slug);
    if (legacy.kind === "redirect") permanentRedirect(legacy.url);
    notFound();
  }

  const hasContact = Boolean(member.email || member.phone || member.social.instagram || member.social.linkedin);
  return <>
    <ScrollToTop />
    <SiteHeader locale={locale as Locale} dict={dict} />
    <main>
      <PageBanner title={member.name} current={member.name} homeLabel={dict.common.home} homeHref={homeHref(locale)} />
      <Reveal className="mx-auto max-w-7xl px-[15px] py-[120px]">
        <div className="grid items-start gap-12 lg:grid-cols-[minmax(0,430px)_minmax(0,1fr)]">
          <div>
            <img src={member.image.url} alt={member.image.altText} className="aspect-[4/5] w-full object-cover" />
            <div className="relative z-10 mx-5 -mt-12 bg-brand px-7 py-6 text-base shadow-card">
              <h1 className="font-display text-3xl font-bold leading-tight">{member.name}</h1>
              <p className="mt-1 text-base/80">{member.role}</p>
            </div>
            {hasContact ? <aside className="mx-5 border border-t-0 border-hairline bg-base p-7 shadow-card">
              <h2 className="font-display text-2xl font-bold text-ink">{dict.teamDetailPage.contactTitle}</h2>
              <div className="mt-5 space-y-4">
                {member.email ? <a href={`mailto:${member.email}`} className="flex items-center gap-3 text-muted transition hover:text-brand"><IconEnvelope className="h-5 w-5 shrink-0 text-brand" /><span className="break-all">{member.email}</span></a> : null}
                {member.phone ? <a href={`tel:${member.phone.replace(/\s+/g, "")}`} className="flex items-center gap-3 text-muted transition hover:text-brand"><IconPhone className="h-5 w-5 shrink-0 text-brand" /><span dir="ltr">{member.phone}</span></a> : null}
              </div>
              {member.social.instagram || member.social.linkedin ? <div className="mt-6 flex flex-wrap gap-3">
                {member.social.instagram ? <a href={member.social.instagram} target="_blank" rel="noreferrer" aria-label="Instagram" className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-soft text-brand transition hover:bg-brand hover:text-base"><IconInstagram className="h-5 w-5" /></a> : null}
                {member.social.linkedin ? <a href={member.social.linkedin} target="_blank" rel="noreferrer" aria-label="LinkedIn" className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-soft text-brand transition hover:bg-brand hover:text-base"><IconLinkedin className="h-5 w-5" /></a> : null}
              </div> : null}
            </aside> : null}
          </div>

          <div>
            <div className="text-lg leading-8 text-muted" dangerouslySetInnerHTML={{ __html: member.bio }} />

            <Link href={aboutHref(locale)} className="mt-12 inline-flex border border-hairline px-7 py-3 font-semibold text-ink transition hover:border-brand hover:text-brand">{dict.teamDetailPage.backLabel}</Link>
          </div>
        </div>
      </Reveal>
    </main>
    <Footer locale={locale as Locale} dict={dict} />
  </>;
}
