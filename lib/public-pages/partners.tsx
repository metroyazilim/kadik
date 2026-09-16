import type { Metadata } from "next";
import Footer from "@/components/Footer";
import ScrollToTop from "@/components/ScrollToTop";
import PageBanner from "@/components/PageBanner";
import Reveal from "@/components/Reveal";
import SectionHeading from "@/components/SectionHeading";
import SiteHeader from "@/components/SiteHeader";
import { getPublicDictionary } from "@/lib/content";
import { prisma } from "@/lib/db";
import { loadPublicHomeView } from "@/lib/content-model/home-public-view";
import type { HomeWidgetConfig } from "@/lib/content-model/home-section-schemas";
import type { Locale } from "@/lib/i18n/config";
import { staticAlternates, staticPath } from "@/lib/i18n/static-pages";

/** Only a literal hex colour ever reaches the style attribute, same guard
 * `BrandTrustPart` uses for the identical `logoItems[].bgColor` field. */
const HEX_COLOR = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export async function generatePartnersMetadata(locale: Locale): Promise<Metadata> {
  const dict = await getPublicDictionary(locale);
  return { ...dict.meta.partners, alternates: staticAlternates(locale, "partners") };
}

/**
 * Shared Partners body consumed by every locale's thin `/partnerler` (and
 * `/en/partners`) route file. Deliberately not a second content model: the
 * grid reads the same published `brandTrust` Home section (`logoItems`) an
 * admin already manages from `/manage/home` - a dedicated page for those
 * logos, not a place to duplicate and re-curate them. Rendered as a static
 * grid rather than `BrandTrustPart`'s `Marquee`: this page's whole purpose
 * is showing every partner clearly, not a scrolling trust strip.
 */
export async function PartnersPage({ locale }: { locale: Locale }) {
  const [dict, homeView] = await Promise.all([
    getPublicDictionary(locale),
    loadPublicHomeView(prisma, locale),
  ]);

  const brandSection = homeView.composition.sections.find((section) => section.key === "brandTrust");
  // Same lightweight cast HomeComposed uses for every section's widget: the
  // payload came from a published revision already validated at write time.
  const widget = (brandSection?.payload as { widget?: HomeWidgetConfig } | null)?.widget ?? {};
  const logos = (widget.logoItems ?? []).flatMap((item) => {
    const url = item.assetId ? homeView.mediaAssetsById[item.assetId]?.url : undefined;
    return url ? [{ url, alt: item.altText, bgColor: item.bgColor }] : [];
  });

  return (
    <>
      <ScrollToTop />
      <SiteHeader locale={locale} dict={dict} />
      <main>
        <PageBanner
          title={dict.partnersPage.banner}
          current={dict.partnersPage.banner}
          homeLabel={dict.common.home}
          homeHref={staticPath(locale, "home")}
        />
        <section className="py-[120px]">
          <Reveal className="mx-auto max-w-4xl px-[15px]">
            <SectionHeading subtitle={dict.partnersPage.subtitle} title={dict.partnersPage.title} align="center" />
            <p className="mx-auto mt-6 max-w-2xl text-center leading-7 text-muted">{dict.partnersPage.intro}</p>
          </Reveal>
          {logos.length > 0 ? (
            <div className="mx-auto mt-12 grid max-w-6xl grid-cols-2 gap-6 px-[15px] sm:grid-cols-3 md:grid-cols-4">
              {logos.map((logo, index) => {
                const tile = logo.bgColor && HEX_COLOR.test(logo.bgColor) ? logo.bgColor : null;
                return (
                  <div
                    key={`${logo.url}-${index}`}
                    className="flex items-center justify-center rounded-[15px] border border-hairline bg-base p-6 shadow-card transition-shadow hover:shadow-[var(--shadow-card)]"
                    style={tile ? { backgroundColor: tile } : undefined}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={logo.url}
                      alt={logo.alt}
                      className="max-h-16 w-full object-contain opacity-90 transition-opacity hover:opacity-100"
                    />
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="mx-auto mt-12 max-w-2xl border border-hairline bg-base px-6 py-12 text-center text-muted shadow-card">
              {dict.partnersPage.empty}
            </p>
          )}
        </section>
      </main>
      <Footer locale={locale} dict={dict} />
    </>
  );
}
