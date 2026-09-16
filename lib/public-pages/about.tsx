import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ContentLocale } from "@prisma/client";
import Footer from "@/components/Footer";
import ScrollToTop from "@/components/ScrollToTop";
import Marquee from "@/components/Marquee";
import OfferItem from "@/components/OfferItem";
import PageBanner from "@/components/PageBanner";
import Reveal from "@/components/Reveal";
import SectionHeading from "@/components/SectionHeading";
import SiteHeader from "@/components/SiteHeader";
import TeamCard from "@/components/TeamCard";
import ThemeButton from "@/components/ThemeButton";
import type { Locale } from "@/lib/i18n/config";
import { staticAlternates, staticPath } from "@/lib/i18n/static-pages";
import { getPublicDictionary } from "@/lib/content";
import { listPublishedTeamMembers } from "@/lib/public-content/team";
import { getPublicAboutPage } from "@/lib/public-content/content-page";
import { getSiteSeoDefaults } from "@/lib/content-model/site-seo-defaults";
import { prisma } from "@/lib/db";

import { DUMMY_ABOUT_IMAGE, DUMMY_TEAM_IMAGES, dummyImage } from "@/lib/media/dummy-images";
const OFFER_KEYS = ["Website", "Android", "IOS", "Watch", "IOT"] as const;
/** Same separator convention as `public-seo.ts`'s `composeSeoMetadata` (entity content); About has no `ContentRoute` so it cannot reuse that function directly (it requires a route-registry `FallbackResolution`), but the title/canonical/robots composition it performs is mirrored here by hand - including reading the site name through the same `getSiteSeoDefaults` every other content type's `generateMetadata` uses, so a published site-settings brand-name change reaches `/hakkimizda`'s `<title>` exactly like it reaches every other page. */
const TITLE_SEPARATOR = " | ";

/** Turkish's own team collection segment is prefixless (`/ekip/<slug>`,
 * Spec 2); `en`/`ru`/`ar` keep their pre-existing `/${locale}/team/<slug>`
 * link exactly as before - fixing their native-script segment mismatch is
 * out of this spec's scope (see spec-2.md \u00a73.2). */
function teamMemberHref(locale: Locale, slug: string): string {
  return locale === "tr" ? `/ekip/${slug}` : `/${locale}/team/${slug}`;
}

/**
 * AC-3.14: title/description prefer the published payload's own SEO
 * fields, falling back to the page's heading (`banner`) and the unchanged
 * page-chrome `dict.meta.about.description`. A Turkish-fallback render
 * (AC-3.4) canonicalizes to `/hakkimizda`, is `noindex, follow`, and is
 * excluded from this locale's own hreflang set (an empty `languages` map -
 * the served content is borrowed, not this locale's own unique page).
 * `about === null` (nothing published in any locale yet, e.g. before the
 * backfill has ever run) degrades to the same safe dictionary-only
 * metadata the pre-cutover page always emitted.
 */
export async function generateAboutMetadata(locale: Locale): Promise<Metadata> {
  const [dict, about] = await Promise.all([
    getPublicDictionary(locale),
    getPublicAboutPage(locale as ContentLocale),
  ]);
  const alternates = staticAlternates(locale, "about");
  if (!about) {
    return { title: dict.meta.about.title, description: dict.meta.about.description, alternates };
  }

  const seoDefaults = await getSiteSeoDefaults(prisma, locale as ContentLocale);
  const title = `${about.page.seoTitle ?? about.page.banner}${TITLE_SEPARATOR}${seoDefaults.siteName}`;
  const description = about.page.seoDescription ?? dict.meta.about.description;

  if (about.fallbackApplied) {
    return {
      title,
      description,
      alternates: { canonical: staticAlternates("tr", "about").canonical, languages: {} },
      robots: { index: false, follow: true },
    };
  }

  return { title, description, alternates };
}

/**
 * Shared About body consumed by every locale's thin `/hakkimizda` (and
 * `/en/about`) route file - mirrors
 * `BlogList`/`TeamMemberDetail`'s one-shared-component-per-surface pattern.
 * Spec 3: every visible string and image now comes from the published
 * `content-page:about` entity (`getPublicAboutPage`) instead of the
 * deleted `dict.aboutPage`; `common`/`dict.team.members` (page chrome and
 * the unrelated Home team fallback) are untouched.
 */
export async function AboutPage({ locale }: { locale: Locale }) {
  const [dict, teamMembers, about] = await Promise.all([
    getPublicDictionary(locale),
    listPublishedTeamMembers(locale as ContentLocale),
    getPublicAboutPage(locale as ContentLocale),
  ]);
  if (!about) notFound();
  const { page, collageImage, authorImage, fallbackApplied } = about;
  const { common } = dict;

  return <>
    <ScrollToTop /><SiteHeader locale={locale} dict={dict} />
    <main>
      <PageBanner title={page.banner} current={page.banner} homeLabel={common.home} homeHref={staticPath(locale, "home")} />
      {fallbackApplied ? (
        <p role="status" className="mx-auto mt-6 max-w-7xl border border-hairline bg-base px-6 py-4 text-center text-sm font-medium text-ink">
          {common.aboutFallbackNotice}
        </p>
      ) : null}
      <section className="bg-[#f7f8ff] py-[120px]"><Reveal className="mx-auto grid max-w-7xl items-center gap-16 px-[15px] lg:grid-cols-2">
        <div className="relative pb-24 ps-16"><span aria-hidden className="absolute start-1/2 top-0 h-[194px] w-[194px] -translate-x-1/2 rounded-full border border-hairline" />{/* eslint-disable-next-line @next/next/no-img-element */}<img src={collageImage.url || DUMMY_ABOUT_IMAGE} alt={page.collageAlt} className="relative ms-auto aspect-[3/4] w-[267px] border-[10px] border-base object-cover" /><div className="absolute bottom-6 start-0 flex items-center gap-4 bg-brand p-6 text-base"><div><h3 className="font-display font-medium leading-tight"><span className="text-[28px] font-bold">{page.experienceValue}</span> {page.experienceUnit}</h3><p className="text-[14px]">{page.experienceLabel}</p></div></div></div>
        <div><SectionHeading subtitle={page.subtitle} title={<>{page.titleBefore} <span className="text-brand">{page.titleAccent}</span> {page.titleAfter}</>} /><div className="mt-6 leading-7 text-muted" dangerouslySetInnerHTML={{ __html: page.text }} /><div className="mt-8 flex flex-wrap gap-8 border-b border-hairline pb-10">{page.features.map((item, i) => <div key={`${item.title}-${i}`} className="flex items-start gap-6"><span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand-soft font-display text-[20px] font-bold text-brand">{i + 1}</span><div className="max-w-[240px]"><h4 className="font-display text-[24px] font-bold leading-[34px] text-ink">{item.title}</h4><p className="leading-7 text-muted">{item.text}</p></div></div>)}</div><div className="mt-8 flex flex-wrap items-center gap-8"><ThemeButton href={`/${locale}`}>{common.learnMore}</ThemeButton><div className="flex items-center gap-4">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={authorImage.url || dummyImage(DUMMY_TEAM_IMAGES, 0)} alt={page.authorName} className="h-14 w-14 rounded-full object-cover" /><div><h6 className="font-display text-[18px] font-bold leading-[27px] text-ink">{page.authorName}</h6><p className="text-[14px] font-medium text-muted">{page.authorRole}</p></div></div></div></div>
      </Reveal></section>
      <section className="relative overflow-hidden bg-navy py-[120px] text-base"><div aria-hidden className="pointer-events-none absolute inset-y-0 end-0 w-1/3" style={{ backgroundImage: "linear-gradient(to left, rgba(56,75,255,.28), transparent)" }} /><Reveal className="relative mx-auto max-w-7xl px-[15px]"><SectionHeading subtitle={page.offeringSubtitle} title={page.offeringTitle} align="center" tone="light" /><div className="mt-14 grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-5">{page.offeringLabels.map((label, i) => <OfferItem key={`${label}-${i}`} iconKey={OFFER_KEYS[i]} label={label} highlighted={i === 2} />)}</div></Reveal></section>
      <Marquee className="py-6" itemClassName="gap-10 pe-10">{page.marquee.map((word, i) => <span key={`${word}-${i}`} className="flex items-center gap-10 whitespace-nowrap font-display text-[60px] font-bold capitalize text-brand"><i aria-hidden className="not-italic">✱</i>{word}</span>)}</Marquee>
      <section className="pb-[120px]"><Reveal className="mx-auto max-w-7xl px-[15px]"><div className="flex flex-wrap items-center justify-between gap-6"><SectionHeading subtitle={page.teamSubtitle} title={page.teamTitle} /><ThemeButton href={staticPath(locale, "home")}>{common.allMembers}</ThemeButton></div>{teamMembers.length > 0 ? <div className={`mt-14 grid auto-rows-fr items-stretch gap-7 ${teamMembers.length <= 2 ? "sm:grid-cols-2" : teamMembers.length === 3 ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-2 lg:grid-cols-4"}`}>{teamMembers.slice(0, 4).map((member, i) => <TeamCard key={member.entityId} image={member.image.url || dummyImage(DUMMY_TEAM_IMAGES, i)} name={member.name} role={member.role} variant="boxed" href={teamMemberHref(locale, member.slug)} socials={member.social} />)}</div> : null}</Reveal></section>
    </main><Footer locale={locale} dict={dict} />
  </>;
}
