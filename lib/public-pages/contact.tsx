import type { Metadata } from "next";
import type { ContentLocale } from "@prisma/client";
import ContactForm from "@/components/ContactForm";
import Footer from "@/components/Footer";
import { IconEnvelope, IconLocation, IconPhone } from "@/components/Icon";
import ScrollToTop from "@/components/ScrollToTop";
import PageBanner from "@/components/PageBanner";
import Reveal from "@/components/Reveal";
import SectionHeading from "@/components/SectionHeading";
import SiteHeader from "@/components/SiteHeader";
import { getPublicDictionary } from "@/lib/content";
import { getPublicSiteSettings } from "@/lib/public-content/site-settings";
import { buildSiteShellView } from "@/lib/public-content/site-shell-view";
import type { Locale } from "@/lib/i18n/config";
import { staticAlternates, staticPath } from "@/lib/i18n/static-pages";

export async function generateContactMetadata(locale: Locale): Promise<Metadata> {
  const meta = (await getPublicDictionary(locale)).meta.contact;
  return {
    title: meta.title,
    description: meta.description,
    alternates: staticAlternates(locale, "contact"),
  };
}

/**
 * Shared Contact body consumed by every locale's thin `/iletisim` (and
 * `/en/contact`) route file. Spec 3 AC-3.10:
 * phone/email/address are resolved from the same published site-settings
 * projection the header/footer shell renders (`buildSiteShellView`, the
 * one place that already owns the per-field "settings value, else the
 * `lib/contact.ts` default" fallback) - this page never imports `CONTACT`
 * or renders one of its values directly.
 */
export async function ContactPage({
  locale,
  subjectPreset,
}: {
  locale: Locale;
  subjectPreset?: string;
}) {
  const [dict, settings] = await Promise.all([
    getPublicDictionary(locale),
    getPublicSiteSettings(locale as ContentLocale),
  ]);
  const { contactPage: contact, common } = dict;
  const view = buildSiteShellView(settings, dict, locale);

  return (
    <>
      <ScrollToTop />
      <SiteHeader locale={locale} dict={dict} />
      <main>
        <PageBanner
          title={contact.banner}
          current={contact.banner}
          homeLabel={common.home}
          homeHref={staticPath(locale, "home")}
        />
        <section className="py-[120px]">
          <Reveal className="mx-auto max-w-7xl px-[15px]">
            <div className="max-w-3xl">
              <SectionHeading subtitle={contact.subtitle} title={contact.title} />
              <p className="mt-6 leading-8 text-muted">{contact.intro}</p>
            </div>
            <div className="mt-14 grid items-start gap-8 lg:grid-cols-[0.8fr_1.2fr]">
              <aside className="border border-hairline bg-base p-7 shadow-card sm:p-10">
                <h2 className="font-display text-[30px] font-bold leading-tight text-ink">
                  {contact.infoTitle}
                </h2>
                <div className="mt-8 space-y-5">
                  <div className="flex items-start gap-4 border-b border-hairline pb-5">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
                      <IconPhone className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-muted">{contact.phoneLabel}</p>
                      <a href={view.contact.phoneHref} dir="ltr" className="mt-1 block font-display text-xl font-semibold text-ink hover:text-brand">
                        {view.contact.phone}
                      </a>
                    </div>
                  </div>
                  <div className="flex items-start gap-4 border-b border-hairline pb-5">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
                      <IconEnvelope className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-muted">{contact.emailLabel}</p>
                      <a href={view.contact.emailHref} dir="ltr" className="mt-1 block break-all font-display text-xl font-semibold text-ink hover:text-brand">
                        {view.contact.email}
                      </a>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
                      <IconLocation className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-muted">{contact.addressLabel}</p>
                      <p className="mt-1 font-display text-xl font-semibold leading-7 text-ink">{view.contact.address ?? dict.footer.locationValue}</p>
                    </div>
                  </div>
                </div>
              </aside>
              <section className="border border-hairline bg-[#f7f8ff] p-7 shadow-card sm:p-10">
                <h2 className="mb-8 font-display text-[30px] font-bold leading-tight text-ink">
                  {contact.formTitle}
                </h2>
                <ContactForm locale={locale} dict={dict} subjectPreset={subjectPreset} />
              </section>
            </div>
          </Reveal>
        </section>
      </main>
      <Footer locale={locale} dict={dict} />
    </>
  );
}
