import type { ContentLocale } from "@prisma/client";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import Footer from "@/components/Footer";
import ScrollToTop from "@/components/ScrollToTop";
import PageBanner from "@/components/PageBanner";
import Reveal from "@/components/Reveal";
import SiteHeader from "@/components/SiteHeader";
import { ContentBlocks } from "@/components/public/ContentBlocks";
import { getPublicDictionary } from "@/lib/content";
import type { FallbackResolution } from "@/lib/content-model/route-registry";
import { PRODUCT_COLLECTION_SEGMENTS } from "@/lib/content-model/product-routes";
import { composeSeoMetadata, buildHreflangAlternates } from "@/lib/content-model/public-seo";
import { getSiteSeoDefaults } from "@/lib/content-model/site-seo-defaults";
import { resolveFallbackAliasRedirect } from "@/lib/content-model/public-seo-redirect";
import { prisma } from "@/lib/db";
import { SITE_URL } from "@/lib/i18n/config";
import { getProductAlternates, getPublishedProductByRoute } from "@/lib/public-content/product";

const LOCALE = "tr" as const;
type Params = Promise<{ slug: string }>;

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const product = await getPublishedProductByRoute(LOCALE, slug);
  if (!product) return {};

  const [alternateRoutes, defaults] = await Promise.all([
    getProductAlternates(product.entityId),
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

  const canonical = `${SITE_URL}${product.canonicalUrl}`;
  const route: FallbackResolution = product.noindex
    ? { kind: "fallback", url: canonical, canonical, noindex: true }
    : { kind: "native", url: canonical };
  const seo = composeSeoMetadata(
    route,
    {
      title: product.seoTitle ?? product.title,
      description: product.seoDescription ?? product.summary,
      ogImageUrl: product.image.isFallback ? undefined : product.image.url,
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

export default async function ProductPage({ params }: { params: Params }) {
  const { slug } = await params;
  const [dict, product] = await Promise.all([getPublicDictionary(LOCALE), getPublishedProductByRoute(LOCALE, slug)]);
  if (!product) {
    const legacy = await resolveFallbackAliasRedirect(prisma, LOCALE, PRODUCT_COLLECTION_SEGMENTS[LOCALE], slug);
    if (legacy.kind === "redirect") permanentRedirect(legacy.url);
    notFound();
  }
  const copy = dict.productDetailPage;
  const ctaHref = product.ctaUrl ?? `/${LOCALE}/contact?subject=${encodeURIComponent(product.title)}`;

  return <>
    <ScrollToTop />
    <SiteHeader locale={LOCALE} dict={dict} />
    <main>
      <PageBanner title={product.title} current={product.title} homeLabel={dict.common.home} homeHref={`/${LOCALE}`} />
      <Reveal className="mx-auto max-w-6xl px-[15px] py-[120px]">
        <Link href="/urunler" className="font-semibold text-brand transition-colors hover:text-ink">{copy.backLabel}</Link>
        <div className="mt-8 grid items-start gap-12 lg:grid-cols-[1.05fr_0.95fr]">
          <img src={product.image.url} alt={product.image.altText} className="aspect-[660/391] w-full rounded-[15px] object-cover shadow-card" />
          <div>
            {product.badge ? <span className="inline-flex rounded-pill bg-brand px-4 py-1 text-sm font-semibold text-base">{product.badge}</span> : null}
            <h1 className="mt-5 font-display text-4xl font-bold leading-tight text-ink md:text-6xl">{product.title}</h1>
            <p className="mt-5 text-lg leading-8 text-muted">{product.summary}</p>
            {product.priceLabel ? <p className="mt-7 font-display text-3xl font-bold text-brand">{product.priceLabel}</p> : null}
            {product.ctaUrl ? (
              <a href={ctaHref} target="_blank" rel="noreferrer" className="mt-8 inline-flex rounded-pill bg-brand px-7 py-[14px] font-semibold text-base transition-colors hover:bg-ink">{copy.ctaLabel}</a>
            ) : (
              <Link href={ctaHref} className="mt-8 inline-flex rounded-pill bg-brand px-7 py-[14px] font-semibold text-base transition-colors hover:bg-ink">{copy.ctaLabel}</Link>
            )}
          </div>
        </div>
        <section className="mt-16 border-t border-hairline pt-12">
          <ContentBlocks blocks={product.blocks} />
        </section>
        {product.gallery.length > 0 ? (
          <section className="mt-16">
            <h2 className="font-display text-4xl font-bold text-ink">{copy.galleryTitle}</h2>
            <div className="mt-8 grid gap-6 sm:grid-cols-2">
              {product.gallery.map((image, index) => (
                <img key={`${image.url}-${index}`} src={image.url} alt={image.altText} className="aspect-[660/391] w-full rounded-[15px] object-cover shadow-card" />
              ))}
            </div>
          </section>
        ) : null}
      </Reveal>
    </main>
    <Footer locale={LOCALE} dict={dict} />
  </>;
}
