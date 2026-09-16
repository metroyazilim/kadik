import Reveal from "@/components/Reveal";
import SectionHeading from "@/components/SectionHeading";
import ServiceCard from "@/components/ServiceCard";
import ThemeButton from "@/components/ThemeButton";
import type { Locale } from "@/lib/i18n/config";
import { DUMMY_SERVICE_IMAGES, dummyImage } from "@/lib/media/dummy-images";
import { CollectionLayout } from "./CollectionLayout";

export type ServiceItem = Readonly<{
  title: string;
  summary: string;
  image?: string | null;
  icon?: string | null;
  href: string;
}>;

export type ServicesCollectionPartProps = Readonly<{
  locale: Locale;
  subtitle?: string;
  title?: string;
  items?: readonly ServiceItem[];
  layout?: "grid" | "carousel";
  columns?: 2 | 3 | 4;
  limit?: number;
  allButtonLabel?: string;
  allButtonHref?: string;
  readMoreLabel?: string;
}>;

export function ServicesCollectionPart({
  locale,
  subtitle = "",
  title = "",
  items,
  layout = "grid",
  columns = 4,
  limit = 4,
  allButtonLabel = "",
  allButtonHref = `/${locale}/services`,
  readMoreLabel = "",
}: ServicesCollectionPartProps) {
  // Yayınlanmış kayıt yoksa bölüm hiç çizilmez - örnek/uydurma kart üretilmez.
  if (!items || items.length === 0) return null;
  const displayList = items.slice(0, limit);

  return (
    <section id="services" className="bg-[#f7f8ff] py-[120px]">
      <Reveal className="mx-auto max-w-7xl px-[15px]">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <SectionHeading subtitle={subtitle} title={title} />
          {allButtonLabel.trim() && allButtonHref ? <ThemeButton href={allButtonHref}>{allButtonLabel}</ThemeButton> : null}
        </div>
        <CollectionLayout mode={layout} columns={columns} count={displayList.length}>
          {displayList.map((service, index) => (
            <ServiceCard
              key={service.title}
              image={service.image || dummyImage(DUMMY_SERVICE_IMAGES, index)}
              icon={service.icon ?? null}
              title={service.title}
              text={service.summary}
              readMore={readMoreLabel}
              href={service.href}
            />
          ))}
        </CollectionLayout>
      </Reveal>
    </section>
  );
}
