import type { Metadata } from "next";
import type { ContentLocale } from "@prisma/client";
import CounterItem from "@/components/CounterItem";
import Footer from "@/components/Footer";
import { IconCheck } from "@/components/Icon";
import ScrollToTop from "@/components/ScrollToTop";
import PageBanner from "@/components/PageBanner";
import Reveal from "@/components/Reveal";
import SectionHeading from "@/components/SectionHeading";
import SiteHeader from "@/components/SiteHeader";
import ThemeButton from "@/components/ThemeButton";
import { getPublicDictionary } from "@/lib/content";
import { getPublicSiteSettings } from "@/lib/public-content/site-settings";
import type { Locale } from "@/lib/i18n/config";
import { staticAlternates, staticPath } from "@/lib/i18n/static-pages";



export async function generateMissionVisionMetadata(locale: Locale): Promise<Metadata> {
  const meta = (await getPublicDictionary(locale)).meta.missionVision;
  return {
    title: meta.title,
    description: meta.description,
    alternates: staticAlternates(locale, "missionVision"),
  };
}

/**
 * Shared Mission & Vision body consumed by every locale's thin
 * `/misyon-ve-vizyon` (and `/en/mission-vision`) route file. Spec 3 AC-3.9:
 * the mission/vision
 * paragraph bodies come from published `site-settings.mission`/`vision`
 * (already read by the header/footer shell through `getPublicSiteSettings`
 * - this is the same published projection, never a second read path);
 * `SiteSettingsPayload` and `SITE_SETTINGS_SCHEMA_VERSION` are unchanged.
 * `missionTitle`/`visionTitle` stay page chrome (dictionary), matching the
 * `valuesSubtitle`/`indicatorsTitle`/... labels around them.
 */
export async function MissionVisionPage({ locale }: { locale: Locale }) {
  const [dict, settings] = await Promise.all([
    getPublicDictionary(locale),
    getPublicSiteSettings(locale as ContentLocale),
  ]);
  const { missionVisionPage: page, common } = dict;
  const pillars = [
    { title: page.missionTitle, text: settings?.mission?.trim() ?? "" },
    { title: page.visionTitle, text: settings?.vision?.trim() ?? "" },
  ].filter((pillar) => pillar.text.length > 0);

  return (
    <>
      <ScrollToTop />
      <SiteHeader locale={locale} dict={dict} />
      <main>
        <PageBanner title={page.banner} current={page.banner} homeLabel={common.home} homeHref={staticPath(locale, "home")} />

        {pillars.length > 0 ? (
          <section className="py-[120px]">
            <Reveal className="mx-auto max-w-7xl px-[15px]">
              <SectionHeading subtitle={page.subtitle} title={page.title} align="center" />
              <div className="mx-auto mt-14 grid max-w-5xl gap-8 md:grid-cols-2">
                {pillars.map((item) => (
                  <article key={item.title} className="flex items-start gap-6 border border-hairline bg-base p-8 shadow-card sm:p-10">
                    <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
                      <IconCheck className="h-8 w-8" />
                    </span>
                    <div>
                      <h2 className="font-display text-[28px] font-bold leading-[36px] text-ink">{item.title}</h2>
                      <p className="mt-3 leading-8 text-muted">{item.text}</p>
                    </div>
                  </article>
                ))}
              </div>
            </Reveal>
          </section>
        ) : null}

        <section className="bg-[#f7f8ff] py-[120px]">
          <Reveal className="mx-auto max-w-7xl px-[15px]">
            <SectionHeading subtitle={page.valuesSubtitle} title={page.valuesTitle} align="center" />
            <div className="mt-14 grid gap-7 sm:grid-cols-2 lg:grid-cols-4">
              {page.values.map((item) => (
                <article key={item.title} className="border border-hairline bg-base p-7 shadow-card">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-soft text-brand">
                    <IconCheck className="h-5 w-5" />
                  </span>
                  <h3 className="mt-6 font-display text-2xl font-bold text-ink">{item.title}</h3>
                  <p className="mt-3 leading-7 text-muted">{item.text}</p>
                </article>
              ))}
            </div>
          </Reveal>
        </section>

        <section className="relative overflow-hidden bg-navy py-20 text-base">
          <div aria-hidden className="pointer-events-none absolute -bottom-24 end-[-6rem] h-[380px] w-[380px] rounded-full" style={{ backgroundImage: "radial-gradient(circle, rgba(56,75,255,.35), transparent 65%)" }} />
          <Reveal className="relative mx-auto grid max-w-7xl items-center gap-12 px-[15px] lg:grid-cols-[1.1fr_1.9fr]">
            <SectionHeading subtitle={page.indicatorsSubtitle} title={page.indicatorsTitle} tone="light" />
            <div className="grid grid-cols-2 gap-10 md:grid-cols-4">
              {dict.achievements.items.map((item, index) => (
                <CounterItem
                  key={item.label}
                  icon={null}
                  value={item.value}
                  label={item.label}
                  divider={index < dict.achievements.items.length - 1}
                />
              ))}
            </div>
          </Reveal>
        </section>

        <section className="py-[120px]">
          <Reveal className="mx-auto max-w-7xl px-[15px]">
            <div className="grid items-center gap-10 rounded-[var(--radius-lg)] bg-brand px-8 py-14 text-base md:grid-cols-[1fr_auto] md:px-16 md:py-16">
              <div>
                <h2 className="font-display text-[34px] font-bold leading-tight">{page.ctaTitle}</h2>
                <p className="mt-3 max-w-3xl leading-7 text-base/80">{page.ctaText}</p>
              </div>
              <div className="justify-self-start md:justify-self-end">
                <ThemeButton href={staticPath(locale, "contact")} variant="light">{common.contactUs}</ThemeButton>
              </div>
            </div>
          </Reveal>
        </section>
      </main>
      <Footer locale={locale} dict={dict} />
    </>
  );
}
