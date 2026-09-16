import type { Metadata } from "next";
import FaqAccordion from "@/components/FaqAccordion";
import Footer from "@/components/Footer";
import ScrollToTop from "@/components/ScrollToTop";
import PageBanner from "@/components/PageBanner";
import Reveal from "@/components/Reveal";
import SectionHeading from "@/components/SectionHeading";
import SiteHeader from "@/components/SiteHeader";
import { getPublicDictionary } from "@/lib/content";
import type { Locale } from "@/lib/i18n/config";
import { staticAlternates, staticPath } from "@/lib/i18n/static-pages";
import { listPublishedFaqs } from "@/lib/public-content/faq";

export async function generateFaqMetadata(locale: Locale): Promise<Metadata> {
  const dict = await getPublicDictionary(locale);
  return { ...dict.meta.faq, alternates: staticAlternates(locale, "faq") };
}

/**
 * Shared FAQ body consumed by every locale's thin `/sss` (and `/en/faq`)
 * route file.
 */
export async function FaqPage({ locale }: { locale: Locale }) {
  const [dict, faqs] = await Promise.all([getPublicDictionary(locale), listPublishedFaqs(locale)]);

  return <>
    <ScrollToTop />
    <SiteHeader locale={locale} dict={dict} />
    <main>
      <PageBanner title={dict.faqPage.banner} current={dict.faqPage.banner} homeLabel={dict.common.home} homeHref={staticPath(locale, "home")} />
      <section className="py-[120px]">
        <Reveal className="mx-auto max-w-4xl px-[15px]">
          <SectionHeading subtitle={dict.faqPage.subtitle} title={dict.faqPage.title} align="center" />
          <p className="mx-auto mt-6 max-w-2xl text-center leading-7 text-muted">{dict.faqPage.intro}</p>
          <div className="mt-12">{faqs.length > 0 ? <FaqAccordion items={faqs.map((faq) => ({ id: faq.entityId, question: faq.question, answer: faq.answer }))} /> : <p className="border border-hairline bg-base px-6 py-12 text-center text-muted shadow-card">{dict.faqPage.empty}</p>}</div>
        </Reveal>
      </section>
    </main>
    <Footer locale={locale} dict={dict} />
  </>;
}
