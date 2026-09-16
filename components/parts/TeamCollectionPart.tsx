import Reveal from "@/components/Reveal";
import SectionHeading from "@/components/SectionHeading";
import TeamCard from "@/components/TeamCard";
import ThemeButton from "@/components/ThemeButton";
import type { Locale } from "@/lib/i18n/config";
import { DUMMY_TEAM_IMAGES, dummyImage } from "@/lib/media/dummy-images";
import { CollectionLayout } from "./CollectionLayout";

export type TeamMemberItem = Readonly<{
  key?: string;
  name: string;
  role: string;
  image?: string | null;
  href: string;
  social?: Readonly<{ instagram: string | null; linkedin: string | null }> | null;
}>;

export type TeamCollectionPartProps = Readonly<{
  locale: Locale;
  subtitle?: string;
  title?: string;
  items?: readonly TeamMemberItem[];
  layout?: "grid" | "carousel";
  columns?: 2 | 3 | 4;
  limit?: number;
  allButtonHref?: string;
  allButtonLabel?: string;
}>;

export function TeamCollectionPart({
  locale,
  subtitle = "",
  title = "",
  items,
  layout = "grid",
  columns = 4,
  limit = 4,
  allButtonHref = `/${locale}/about`,
  allButtonLabel = "",
}: TeamCollectionPartProps) {
  if (!items || items.length === 0) return null;
  const displayTeam = items.slice(0, limit);

  return (
    <section className="py-[120px]">
      <Reveal className="mx-auto max-w-7xl px-[15px]">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <SectionHeading subtitle={subtitle} title={title} />
          {allButtonLabel.trim() && allButtonHref ? <ThemeButton href={allButtonHref}>{allButtonLabel}</ThemeButton> : null}
        </div>
        <CollectionLayout mode={layout} columns={columns} count={displayTeam.length}>
          {displayTeam.map((member, index) => (
            <TeamCard
              key={member.key || member.name}
              image={member.image || dummyImage(DUMMY_TEAM_IMAGES, index)}
              name={member.name}
              role={member.role}
              href={member.href}
              socials={member.social ?? undefined}
            />
          ))}
        </CollectionLayout>
      </Reveal>
    </section>
  );
}
