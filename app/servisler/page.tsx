import type { ContentLocale } from "@prisma/client";
import type { Metadata } from "next";
import ContactForm from "@/components/ContactForm";
import FaqAccordion from "@/components/FaqAccordion";
import Footer from "@/components/Footer";
import ScrollToTop from "@/components/ScrollToTop";
import PageBanner from "@/components/PageBanner";
import Reveal from "@/components/Reveal";
import SectionHeading from "@/components/SectionHeading";
import ServiceCard from "@/components/ServiceCard";
import SiteHeader from "@/components/SiteHeader";
import { getPublicDictionary } from "@/lib/content";
import { generateRoute } from "@/lib/content-model/route-registry";
import { SERVICE_COLLECTION_SEGMENTS, serviceRouteCandidate } from "@/lib/content-model/service-routes";
import { LOCALES, SITE_URL } from "@/lib/i18n/config";
import { listPublishedFaqs } from "@/lib/public-content/faq";
import { listPublishedServices } from "@/lib/public-content/service";

const LOCALE = "tr" as const;

function collectionUrl(locale: ContentLocale): string {
  const segment = SERVICE_COLLECTION_SEGMENTS[locale];
  return locale === "tr" ? `/${segment}` : `/${locale}/${segment}`;
}

export const dynamic = "force-dynamic";

/** Service collection alternates always use each locale's native collection segment. */
export async function generateMetadata(): Promise<Metadata> {
  const meta = (await getPublicDictionary(LOCALE)).meta.services;
  const languages: Record<string, string> = {};
  for (const locale of LOCALES) languages[locale] = `${SITE_URL}${collectionUrl(locale)}`;
  languages["x-default"] = `${SITE_URL}${collectionUrl("tr")}`;
  return {
    title: meta.title,
    description: meta.description,
    alternates: {
      canonical: `${SITE_URL}${collectionUrl(LOCALE)}`,
      languages,
    },
  };
}

/** Reads only the shared published Service projection for the Turkish canonical surface. */
export default async function ServicesPage() {
  const [dict, services, faqs] = await Promise.all([
    getPublicDictionary(LOCALE),
    listPublishedServices(LOCALE),
    listPublishedFaqs(LOCALE),
  ]);
  const copy = dict.servicesPage;
  const featuredFaqs = faqs.slice(0, 4);

  return <>
    <ScrollToTop />
    <SiteHeader locale={LOCALE} dict={dict} />
    <main>
      <PageBanner title={copy.banner} current={copy.banner} homeLabel={dict.common.home} homeHref={`/${LOCALE}`} />
      <section className="bg-[#f7f8ff] py-[120px]"><Reveal className="mx-auto max-w-7xl px-[15px]"><SectionHeading subtitle={copy.subtitle} title={copy.title} align="center" /><p className="mx-auto mt-6 max-w-3xl text-center text-lg leading-8 text-muted">{copy.intro}</p>{services.length > 0 ? <div className="mt-14 grid auto-rows-fr items-stretch gap-7 md:grid-cols-2 lg:grid-cols-4">{services.map((service) => <ServiceCard key={service.entityId} image={service.image.url} icon={service.icon} title={service.title} text={service.summary} readMore={dict.common.readMore} href={generateRoute(serviceRouteCandidate(LOCALE, service.slug))} />)}</div> : <p className="mx-auto mt-14 max-w-2xl border border-hairline bg-base px-6 py-12 text-center text-muted shadow-card">{copy.empty}</p>}</Reveal></section>
      {featuredFaqs.length > 0 ? <section className="py-[120px]"><Reveal className="mx-auto grid max-w-7xl items-start gap-12 px-[15px] lg:grid-cols-[0.8fr_1.2fr]"><SectionHeading subtitle={copy.faqSubtitle} title={copy.faqTitle} /><FaqAccordion items={featuredFaqs.map((faq) => ({ id: faq.entityId, question: faq.question, answer: faq.answer }))} /></Reveal></section> : null}
      <section className="bg-navy py-[120px] text-base"><Reveal className="mx-auto grid max-w-7xl items-start gap-12 px-[15px] lg:grid-cols-[0.8fr_1.2fr]"><div><p className="font-display text-sm font-bold uppercase tracking-[0.25em] text-brand">{copy.quoteCta}</p><h2 className="mt-4 font-display text-4xl font-bold leading-tight md:text-5xl">{copy.quoteTitle}</h2><p className="mt-6 max-w-xl leading-8 text-[#d3d7e6]">{copy.quoteText}</p></div><div className="bg-base p-6 text-ink shadow-card sm:p-8"><ContactForm locale={LOCALE} dict={dict} /></div></Reveal></section>
    </main>
    <Footer locale={LOCALE} dict={dict} />
  </>;
}
