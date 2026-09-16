import type { ContentLocale } from "@prisma/client";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import Footer from "@/components/Footer";
import { IconArrowRight } from "@/components/Icon";
import ScrollToTop from "@/components/ScrollToTop";
import PageBanner from "@/components/PageBanner";
import Reveal from "@/components/Reveal";
import SiteHeader from "@/components/SiteHeader";
import { getPublicDictionary } from "@/lib/content";
import { ContentBlocks } from "@/components/public/ContentBlocks";
import { generateRoute, type FallbackResolution } from "@/lib/content-model/route-registry";
import { SERVICE_COLLECTION_SEGMENTS, serviceRouteCandidate } from "@/lib/content-model/service-routes";
import { composeSeoMetadata, buildHreflangAlternates } from "@/lib/content-model/public-seo";
import { getSiteSeoDefaults } from "@/lib/content-model/site-seo-defaults";
import { resolveFallbackAliasRedirect } from "@/lib/content-model/public-seo-redirect";
import { prisma } from "@/lib/db";
import { SITE_URL } from "@/lib/i18n/config";
import {
  getPublishedServiceByRoute,
  getServiceAlternates,
  listPublishedServices,
} from "@/lib/public-content/service";

const LOCALE = "tr" as const;
type Params = Promise<{ slug: string }>;

function collectionUrl(locale: ContentLocale): string {
  const segment = SERVICE_COLLECTION_SEGMENTS[locale];
  return locale === "tr" ? `/${segment}` : `/${locale}/${segment}`;
}

export const dynamic = "force-dynamic";

/** Hreflang includes published routes only; fallback views canonicalize to Turkish. */
export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const service = await getPublishedServiceByRoute(LOCALE, slug);
  if (!service) return {};

  const [alternateRoutes, defaults] = await Promise.all([
    getServiceAlternates(service.entityId),
    getSiteSeoDefaults(prisma, LOCALE),
  ]);
  const nativeUrlsByLocale = new Map(
    Object.entries(alternateRoutes).filter((entry): entry is [ContentLocale, string] => Boolean(entry[1])),
  );
  const languages: Record<string, string> = {};
  for (const alternate of buildHreflangAlternates(nativeUrlsByLocale)) {
    languages[alternate.locale] = `${SITE_URL}${alternate.url}`;
  }
  if (alternateRoutes.tr) languages["x-default"] = `${SITE_URL}${alternateRoutes.tr}`;

  const canonical = `${SITE_URL}${service.canonicalUrl}`;
  const route: FallbackResolution = service.noindex
    ? { kind: "fallback", url: canonical, canonical, noindex: true }
    : { kind: "native", url: canonical };
  const seo = composeSeoMetadata(
    route,
    {
      title: service.seoTitle ?? service.title,
      description: service.seoDescription ?? service.summary,
      ogImageUrl: service.image.isFallback ? undefined : service.image.url,
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

/** Renders the defensively sanitized typed content blocks without applying a third sanitizer. */
export default async function ServicePage({ params }: { params: Params }) {
  const { slug } = await params;
  const [dict, service, services] = await Promise.all([
    getPublicDictionary(LOCALE),
    getPublishedServiceByRoute(LOCALE, slug),
    listPublishedServices(LOCALE),
  ]);
  if (!service) {
    const legacy = await resolveFallbackAliasRedirect(prisma, LOCALE, SERVICE_COLLECTION_SEGMENTS[LOCALE], slug);
    if (legacy.kind === "redirect") permanentRedirect(legacy.url);
    notFound();
  }
  const copy = dict.serviceDetailPage;
  const relatedServices = services.filter((item) => item.entityId !== service.entityId);

  return <>
    <ScrollToTop />
    <SiteHeader locale={LOCALE} dict={dict} />
    <main>
      <PageBanner title={service.title} current={service.title} homeLabel={dict.common.home} homeHref={`/${LOCALE}`} />
      <Reveal className="mx-auto grid max-w-7xl items-start gap-12 px-[15px] py-[120px] lg:grid-cols-[minmax(0,1fr)_360px]">
        <article><img src={service.image.url} alt={service.image.altText} className="max-h-[560px] w-full object-cover" /><p className="mt-10 text-xl leading-9 text-muted">{service.summary}</p><div className="mt-8 border-t border-hairline pt-8"><ContentBlocks blocks={service.blocks} /></div><Link href={collectionUrl(LOCALE)} className="mt-10 inline-flex items-center gap-2 bg-brand px-7 py-3 font-semibold text-base transition hover:bg-ink">{copy.backLabel}<IconArrowRight className="h-4 w-4 rotate-180 rtl:rotate-0" /></Link></article>
        <aside className="space-y-7"><section className="border border-hairline bg-base p-7 shadow-card"><p className="font-display text-sm font-bold uppercase tracking-[0.2em] text-brand">{copy.relatedTitle}</p><h2 className="mt-3 font-display text-3xl font-bold text-ink">{copy.sidebarTitle}</h2>{relatedServices.length > 0 ? <nav className="mt-6 divide-y divide-hairline" aria-label={copy.sidebarTitle}>{relatedServices.map((item) => <Link key={item.entityId} href={generateRoute(serviceRouteCandidate(LOCALE, item.slug))} className="flex items-center justify-between gap-4 py-4 font-semibold text-ink transition hover:text-brand">{item.title}<IconArrowRight className="h-4 w-4 shrink-0 rtl:-scale-x-100" /></Link>)}</nav> : null}</section><section className="border-s-4 border-brand bg-[#f7f8ff] p-7"><h2 className="font-display text-2xl font-bold text-ink">{copy.hoursTitle}</h2><p className="mt-3 leading-7 text-muted">{copy.hoursText}</p></section><section className="bg-navy p-7 text-base"><h2 className="font-display text-2xl font-bold">{copy.helpTitle}</h2><p className="mt-3 leading-7 text-[#d3d7e6]">{copy.helpText}</p><Link href={`/${LOCALE}/contact`} className="mt-6 inline-flex items-center gap-2 bg-brand px-6 py-3 font-semibold transition hover:bg-base hover:text-ink">{copy.helpCta}<IconArrowRight className="h-4 w-4 rtl:-scale-x-100" /></Link></section></aside>
      </Reveal>
    </main>
    <Footer locale={LOCALE} dict={dict} />
  </>;
}
