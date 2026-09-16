import type { ContentLocale } from "@prisma/client";
import type { Metadata } from "next";
import Footer from "@/components/Footer";
import ScrollToTop from "@/components/ScrollToTop";
import PageBanner from "@/components/PageBanner";
import ProductCard from "@/components/ProductCard";
import Reveal from "@/components/Reveal";
import SectionHeading from "@/components/SectionHeading";
import SiteHeader from "@/components/SiteHeader";
import { getPublicDictionary } from "@/lib/content";
import { generateRoute } from "@/lib/content-model/route-registry";
import { PRODUCT_COLLECTION_SEGMENTS, productRouteCandidate } from "@/lib/content-model/product-routes";
import { LOCALES, SITE_URL } from "@/lib/i18n/config";
import { listPublishedProducts } from "@/lib/public-content/product";

const LOCALE = "tr" as const;

function collectionUrl(locale: ContentLocale): string {
  const segment = PRODUCT_COLLECTION_SEGMENTS[locale];
  return locale === "tr" ? `/${segment}` : `/${locale}/${segment}`;
}

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const meta = (await getPublicDictionary(LOCALE)).meta.products;
  const languages: Record<string, string> = {};
  for (const locale of LOCALES) languages[locale] = `${SITE_URL}${collectionUrl(locale)}`;
  languages["x-default"] = `${SITE_URL}${collectionUrl("tr")}`;
  return { title: meta.title, description: meta.description, alternates: { canonical: `${SITE_URL}${collectionUrl(LOCALE)}`, languages } };
}

export default async function ProductsPage() {
  const [dict, products] = await Promise.all([getPublicDictionary(LOCALE), listPublishedProducts(LOCALE)]);
  const copy = dict.productsPage;

  return <>
    <ScrollToTop />
    <SiteHeader locale={LOCALE} dict={dict} />
    <main>
      <PageBanner title={copy.banner} current={copy.banner} homeLabel={dict.common.home} homeHref={`/${LOCALE}`} />
      <section className="bg-[#f7f8ff] py-[120px]">
        <Reveal className="mx-auto max-w-7xl px-[15px]">
          <SectionHeading subtitle={copy.subtitle} title={copy.title} align="center" />
          <p className="mx-auto mt-6 max-w-3xl text-center leading-7 text-muted">{copy.intro}</p>
          {products.length === 0 ? (
            <div className="mx-auto mt-14 max-w-2xl rounded-[15px] border border-hairline bg-base px-8 py-14 text-center shadow-card">
              <span className="mx-auto block h-1 w-16 bg-brand" aria-hidden />
              <p className="mt-7 font-display text-2xl font-semibold leading-9 text-ink">{copy.empty}</p>
            </div>
          ) : (
            <div className="mt-14 grid auto-rows-fr items-stretch gap-8 md:grid-cols-2 lg:grid-cols-3">
              {products.map((product) => (
                <ProductCard
                  key={product.entityId}
                  image={product.image.url}
                  title={product.title}
                  shortDescription={product.summary}
                  badge={product.badge}
                  priceLabel={product.priceLabel}
                  href={generateRoute(productRouteCandidate(LOCALE, product.slug))}
                  ctaLabel={copy.ctaLabel}
                />
              ))}
            </div>
          )}
        </Reveal>
      </section>
    </main>
    <Footer locale={LOCALE} dict={dict} />
  </>;
}
