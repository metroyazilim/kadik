import type { ContentLocale } from "@prisma/client";
import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import Footer from "@/components/Footer";
import ScrollToTop from "@/components/ScrollToTop";
import PageBanner from "@/components/PageBanner";
import Reveal from "@/components/Reveal";
import SiteHeader from "@/components/SiteHeader";
import { ContentBlocks } from "@/components/public/ContentBlocks";
import { getPublicDictionary } from "@/lib/content";
import type { FallbackResolution } from "@/lib/content-model/route-registry";
import { POST_COLLECTION_SEGMENTS } from "@/lib/content-model/post-routes";
import { composeSeoMetadata, buildHreflangAlternates } from "@/lib/content-model/public-seo";
import { getSiteSeoDefaults } from "@/lib/content-model/site-seo-defaults";
import { resolveFallbackAliasRedirect } from "@/lib/content-model/public-seo-redirect";
import { prisma } from "@/lib/db";
import { SITE_URL, type Locale } from "@/lib/i18n/config";
import { getPostAlternates, getPublishedPostByRoute } from "@/lib/public-content/post";

import { DUMMY_BLOG_IMAGES } from "@/lib/media/dummy-images";

export async function generateBlogPostMetadata(locale: ContentLocale, slug: string): Promise<Metadata> {
  const post = await getPublishedPostByRoute(locale, slug);
  if (!post) return {};

  const [alternateRoutes, defaults] = await Promise.all([
    getPostAlternates(post.entityId),
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

  const canonical = `${SITE_URL}${post.canonicalUrl}`;
  const route: FallbackResolution = post.noindex
    ? { kind: "fallback", url: canonical, canonical, noindex: true }
    : { kind: "native", url: canonical };
  const seo = composeSeoMetadata(
    route,
    {
      title: post.seoTitle ?? post.title,
      description: post.seoDescription ?? post.excerpt,
      ogImageUrl: post.coverImage.isFallback ? undefined : post.coverImage.url,
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

/** Shared Blog detail surface consumed by every locale's thin native route page - mirrors `TeamMemberDetail`'s one-shared-component pattern. Renders the resolved, twice-sanitized typed content blocks; never a raw `body` string. */
export async function BlogPostDetail({ locale, slug }: { locale: ContentLocale; slug: string }) {
  const [dict, post] = await Promise.all([getPublicDictionary(locale as Locale), getPublishedPostByRoute(locale, slug)]);
  if (!post) {
    const legacy = await resolveFallbackAliasRedirect(prisma, locale, POST_COLLECTION_SEGMENTS[locale], slug);
    if (legacy.kind === "redirect") permanentRedirect(legacy.url);
    notFound();
  }

  const homeHref = locale === "tr" ? "/" : `/${locale}`;
  const dateLabel = new Intl.DateTimeFormat(locale, { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" }).format(post.publishedAt);

  return (
    <>
      <ScrollToTop />
      <SiteHeader locale={locale as Locale} dict={dict} />
      <main>
        <PageBanner title={post.title} current={post.title} homeLabel={dict.common.home} homeHref={homeHref} />
        <Reveal className="mx-auto max-w-4xl px-[15px] py-[120px]">
          <div className="flex flex-wrap gap-5 text-sm text-muted">
            <span>{post.author}</span>
            <span>{post.category}</span>
            <time dateTime={post.publishedAt.toISOString()}>{dateLabel}</time>
          </div>
          <h1 className="mt-5 font-display text-4xl font-bold leading-tight text-ink md:text-6xl">{post.title}</h1>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={post.coverImage.isFallback ? DUMMY_BLOG_IMAGES[0] : post.coverImage.url}
            alt={post.coverImage.isFallback ? "" : post.coverImage.altText}
            className="mt-10 max-h-[520px] w-full object-cover"
          />
          <div className="mt-10">
            <ContentBlocks blocks={post.blocks} />
          </div>
        </Reveal>
      </main>
      <Footer locale={locale as Locale} dict={dict} />
    </>
  );
}
