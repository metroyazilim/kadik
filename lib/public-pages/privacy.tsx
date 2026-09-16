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

export async function generatePrivacyMetadata(locale: Locale): Promise<Metadata> {
  const meta = (await getPublicDictionary(locale)).meta.privacy;
  const legalDoc = await getPublicLegalDocument(locale, "privacy");
  return {
    title: meta.title,
    description: meta.description,
    alternates: staticAlternates(locale, "privacy"),
    robots: legalDoc?.noindex ? { index: false, follow: true } : undefined,
  };
}

/**
 * Shared Privacy body consumed by every locale's thin `/gizlilik-politikasi`
 * (and `/en/privacy`) route file. Spec 3
 * AC-3.11: the permanent `?? dict.legalPage.privacyBody` dictionary
 * fallback is gone - with nothing published in the requested locale and
 * nothing in Turkish, `getPublicLegalDocument` returns `null` and this
 * renders a real `404`, never checked-in copy.
 */
export async function PrivacyPage({ locale }: { locale: Locale }) {
  const [dict, legalDoc] = await Promise.all([getPublicDictionary(locale), getPublicLegalDocument(locale, "privacy")]);
  if (!legalDoc) notFound();

  return (
    <>
      <ScrollToTop />
      <SiteHeader locale={locale} dict={dict} />
      <main>
        <PageBanner
          title={dict.legalPage.privacyBanner}
          current={dict.legalPage.privacyBanner}
          homeLabel={dict.common.home}
          homeHref={staticPath(locale, "home")}
        />
        <LegalDocument updated={dict.legalPage.privacyUpdated} body={legalDoc.body} />
      </main>
      <Footer locale={locale} dict={dict} />
    </>
  );
}
