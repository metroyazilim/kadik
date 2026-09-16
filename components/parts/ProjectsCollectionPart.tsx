import Reveal from "@/components/Reveal";
import SectionHeading from "@/components/SectionHeading";
import ProjectCard from "@/components/ProjectCard";
import { IconArrowRight } from "@/components/Icon";
import type { Locale } from "@/lib/i18n/config";
import { DUMMY_PROJECT_IMAGES, dummyImage } from "@/lib/media/dummy-images";
import { CollectionLayout } from "./CollectionLayout";

export type ProjectItem = Readonly<{
  key?: string;
  title: string;
  category: string;
  image?: string | null;
  href: string;
}>;

export type ProjectsCollectionPartProps = Readonly<{
  locale: Locale;
  subtitle?: string;
  title?: string;
  items?: readonly ProjectItem[];
  layout?: "grid" | "carousel";
  columns?: 2 | 3 | 4;
  limit?: number;
  allButtonHref?: string;
  allButtonLabel?: string;
}>;

export function ProjectsCollectionPart({
  locale,
  subtitle = "",
  title = "",
  items,
  layout = "grid",
  columns = 3,
  limit = 3,
  allButtonHref = `/${locale}/projects`,
  allButtonLabel = "",
}: ProjectsCollectionPartProps) {
  if (!items || items.length === 0) return null;
  const displayProjects = items.slice(0, limit);

  return (
    <section className="bg-navy-deep py-[120px] text-base">
      <Reveal className="mx-auto max-w-7xl px-[15px]">
        <div className="flex items-center justify-between gap-8">
          <SectionHeading subtitle={subtitle} title={title} tone="light" />
          {allButtonLabel.trim() && allButtonHref ? (
            <a
              href={allButtonHref}
              aria-label={allButtonLabel}
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand"
            >
              <IconArrowRight className="h-6 w-6 rtl:-scale-x-100 text-white" />
            </a>
          ) : null}
        </div>
        <div id="projects">
          <CollectionLayout mode={layout} columns={columns} count={displayProjects.length}>
            {displayProjects.map((project, index) => (
              <ProjectCard
                key={project.key || project.title}
                image={project.image || dummyImage(DUMMY_PROJECT_IMAGES, index)}
                category={project.category}
                title={project.title}
                href={project.href}
              />
            ))}
          </CollectionLayout>
        </div>
      </Reveal>
    </section>
  );
}
