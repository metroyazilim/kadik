import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Footer from "@/components/Footer";
import ScrollToTop from "@/components/ScrollToTop";
import PageBanner from "@/components/PageBanner";
import SiteHeader from "@/components/SiteHeader";
import { getPublicDictionary } from "@/lib/content";
import { getPublicLegalDocument } from "@/lib/public-content/site-settings";
import type { Locale } from "@/lib/i18n/config";
import { staticAlternates, staticPath } from "@/lib/i18n/static-pages";
import LegalDocument from "./LegalDocument";

export async function generateTermsMetadata(locale: Locale): Promise<Metadata> {
  const meta = (await getPublicDictionary(locale)).meta.terms;
  const legalDoc = await getPublicLegalDocument(locale, "terms");
  return {
    title: meta.title,
    description: meta.description,
    alternates: staticAlternates(locale, "terms"),
    robots: legalDoc?.noindex ? { index: false, follow: true } : undefined,
  };
}

/**
 * Shared Terms body consumed by every locale's thin `/kullanim-sartlari`
 * (and `/en/terms`) route file. Spec 3 AC-3.11:
 * the permanent `?? dict.legalPage.termsBody` dictionary fallback is gone
 * - with nothing published in the requested locale and nothing in
 * Turkish, `getPublicLegalDocument` returns `null` and this renders a
 * real `404`, never checked-in copy.
 */
export async function TermsPage({ locale }: { locale: Locale }) {
  const [dict, legalDoc] = await Promise.all([getPublicDictionary(locale), getPublicLegalDocument(locale, "terms")]);
  if (!legalDoc) notFound();

  return (
    <>
      <ScrollToTop />
      <SiteHeader locale={locale} dict={dict} />
      <main>
        <PageBanner
          title={dict.legalPage.termsBanner}
          current={dict.legalPage.termsBanner}
          homeLabel={dict.common.home}
          homeHref={staticPath(locale, "home")}
        />
        <LegalDocument updated={dict.legalPage.termsUpdated} body={legalDoc.body} />
      </main>
      <Footer locale={locale} dict={dict} />
    </>
  );
}
