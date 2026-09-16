import SiteHeader from "./SiteHeader";
import Footer from "./Footer";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/types";
import type { HomeComposition } from "@/lib/content-model/home-composer";
import type { HomeWidgetConfig } from "@/lib/content-model/home-section-schemas";
import type { HomePublicMediaAsset } from "@/lib/content-model/home-public-view";
import {
  selectHomeCollectionCards,
  type HomeCollectionCard,
} from "@/lib/public-content/home-collection-source";
import {
  HeroPart,
  AboutSplitPart,
  BrandTrustPart,
  ServicesCollectionPart,
  WorkProcessPart,
  AchievementsCounterPart,
  ProjectsCollectionPart,
  MarqueeStripPart,
  TeamCollectionPart,
  TestimonialsPart,
  BlogCollectionPart,
} from "@/components/parts";

export type FixedHomeCollections = Readonly<{
  services: readonly HomeCollectionCard[];
  projects: readonly HomeCollectionCard[];
  team: readonly HomeCollectionCard[];
  posts: readonly HomeCollectionCard[];
}>;

function mediaUrl(
  assetId: string | null | undefined,
  mediaAssetsById: Readonly<Record<string, HomePublicMediaAsset>>,
): string | undefined {
  return assetId ? mediaAssetsById[assetId]?.url : undefined;
}

function columnsOf(widget: HomeWidgetConfig, fallback: 2 | 3 | 4): 2 | 3 | 4 {
  return widget.columns === "2" ? 2 : widget.columns === "3" ? 3 : widget.columns === "4" ? 4 : fallback;
}

/** Applies the admin's "en yeniler / elle seçtiklerim / kategori" rule and count. */
function cardsFor(
  cards: readonly HomeCollectionCard[],
  widget: HomeWidgetConfig,
  fallbackLimit: number,
): readonly HomeCollectionCard[] {
  return selectHomeCollectionCards(cards, {
    mode: widget.selectionMode ?? "latest",
    selectedEntityIds: widget.selectedEntityIds,
    categories: widget.categories,
    limit: widget.limit ?? fallbackLimit,
  });
}

export default function HomeComposed({
  locale,
  dict,
  composition,
  collections,
  mediaAssetsById,
}: {
  locale: Locale;
  dict: Dictionary;
  composition: HomeComposition;
  collections: FixedHomeCollections;
  mediaAssetsById: Readonly<Record<string, HomePublicMediaAsset>>;
}) {
  return (
    <>
      <SiteHeader locale={locale} dict={dict} />
      <main>
        {composition.sections.map((section) => {
          // No dictionary fallback: a field the admin left empty renders
          // nothing at all, rather than silently reappearing as seed copy.
          const widget = (section.payload as { widget?: HomeWidgetConfig } | null)?.widget ?? {};
          const backgroundImage =
            mediaUrl(widget.bgImageAssetId, mediaAssetsById) ?? widget.bgImage ?? undefined;

          switch (section.key) {
            case "hero":
              return (
                <HeroPart
                  key={section.key}
                  locale={locale}
                  title={widget.title}
                  text={widget.description}
                  bgImageUrl={backgroundImage}
                  variant="wave"
                  primaryButtonLabel={widget.primaryCtaLabel}
                  primaryButtonHref={widget.primaryCtaHref}
                  secondaryButtonLabel={widget.secondaryCtaLabel}
                  secondaryButtonHref={widget.secondaryCtaHref}
                />
              );
            case "about":
              return (
                <AboutSplitPart
                  key={section.key}
                  subtitle={widget.subtitle}
                  title={widget.title}
                  text={widget.description}
                  imageUrl={backgroundImage}
                  checklist={widget.checklist}
                  statValue={widget.statValue}
                  imageAlt={widget.imageAlt}
                  statLabel={widget.statLabel}
                  buttonLabel={widget.primaryCtaLabel}
                  buttonHref={widget.primaryCtaHref}
                  phoneLabel={widget.phoneLabel}
                  phoneNumber={widget.phoneNumber || undefined}
                  phoneHref={widget.phoneHref || undefined}
                />
              );
            case "brandTrust": {
              const logos = (widget.logoItems ?? []).flatMap((item) => {
                const url = mediaUrl(item.assetId, mediaAssetsById);
                return url ? [{ url, alt: item.altText, bgColor: item.bgColor }] : [];
              });
              return (
                <BrandTrustPart
                  key={section.key}
                  label={widget.title}
                  logos={logos.length ? logos : undefined}
                />
              );
            }
            case "services":
              return (
                <ServicesCollectionPart
                  key={section.key}
                  locale={locale}
                  subtitle={widget.subtitle}
                  title={widget.title}
                  items={cardsFor(collections.services, widget, 4).map((card) => ({
                    title: card.title,
                    summary: card.summary,
                    image: card.image,
                    icon: card.icon,
                    href: card.href,
                  }))}
                  layout="grid"
                  columns={columnsOf(widget, 4)}
                  limit={widget.limit ?? 4}
                  allButtonLabel={widget.primaryCtaLabel}
                  allButtonHref={widget.primaryCtaHref || `/${locale}/services`}
                  readMoreLabel={widget.itemCtaLabel}
                />
              );
            case "process":
              return (
                <WorkProcessPart
                  key={section.key}
                  subtitle={widget.subtitle}
                  title={widget.title}
                  items={(widget.processItems ?? []).map((item) => ({
                    title: item.title,
                    text: item.text,
                    iconUrl: mediaUrl(item.iconAssetId, mediaAssetsById),
                  }))}
                />
              );
            case "achievements":
              return (
                <AchievementsCounterPart
                  key={section.key}
                  subtitle={widget.subtitle}
                  title={widget.title}
                  items={(widget.kpiItems ?? []).map((item) => ({
                    value: item.value,
                    label: item.label,
                    iconUrl: mediaUrl(item.iconAssetId, mediaAssetsById),
                  }))}
                />
              );
            case "projects":
              return (
                <ProjectsCollectionPart
                  key={section.key}
                  locale={locale}
                  subtitle={widget.subtitle}
                  title={widget.title}
                  items={cardsFor(collections.projects, widget, 3).map((card) => ({
                    key: card.entityId,
                    title: card.title,
                    category: card.category,
                    image: card.image,
                    href: card.href,
                  }))}
                  layout="grid"
                  columns={columnsOf(widget, 3)}
                  limit={widget.limit ?? 3}
                  allButtonLabel={widget.primaryCtaLabel}
                  allButtonHref={widget.primaryCtaHref || `/${locale}/projects`}
                />
              );
            case "marquee":
              return <MarqueeStripPart key={section.key} words={widget.marqueeItems} />;
            case "team":
              return (
                <TeamCollectionPart
                  key={section.key}
                  locale={locale}
                  subtitle={widget.subtitle}
                  title={widget.title}
                  items={cardsFor(collections.team, widget, 4).map((card) => ({
                    key: card.entityId,
                    name: card.title,
                    role: card.summary,
                    image: card.image,
                    href: card.href,
                    social: card.social,
                  }))}
                  layout="grid"
                  columns={columnsOf(widget, 4)}
                  limit={widget.limit ?? 4}
                  allButtonLabel={widget.primaryCtaLabel}
                  allButtonHref={widget.primaryCtaHref || `/${locale}/about`}
                />
              );
            case "testimonials":
              return (
                <TestimonialsPart
                  key={section.key}
                  subtitle={widget.subtitle}
                  title={widget.title}
                  items={(widget.testimonialItems ?? []).map((item) => ({
                    name: item.name,
                    role: item.role,
                    quote: item.quote,
                    avatarUrl: mediaUrl(item.avatarAssetId, mediaAssetsById),
                  }))}
                />
              );
            case "blog":
              return (
                <BlogCollectionPart
                  key={section.key}
                  locale={locale}
                  subtitle={widget.subtitle}
                  title={widget.title}
                  items={cardsFor(collections.posts, widget, 3).map((card) => ({
                    title: card.title,
                    category: card.category,
                    author: dict.common.editor,
                    day: card.publishedAt
                      ? new Intl.DateTimeFormat(locale, { day: "2-digit", timeZone: "UTC" }).format(card.publishedAt)
                      : "",
                    month: card.publishedAt
                      ? new Intl.DateTimeFormat(locale, { month: "short", timeZone: "UTC" }).format(card.publishedAt)
                      : "",
                    image: card.image,
                    href: card.href,
                  }))}
                  layout="grid"
                  columns={columnsOf(widget, 3)}
                  limit={widget.limit ?? 3}
                  readMoreLabel={widget.itemCtaLabel}
                />
              );
          }
        })}
      </main>
      <Footer locale={locale} dict={dict} />
    </>
  );
}
