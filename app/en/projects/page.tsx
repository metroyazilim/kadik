import type { ContentLocale } from "@prisma/client";
import type { Metadata } from "next";
import Footer from "@/components/Footer";
import ScrollToTop from "@/components/ScrollToTop";
import PageBanner from "@/components/PageBanner";
import ProjectCard from "@/components/ProjectCard";
import Reveal from "@/components/Reveal";
import SectionHeading from "@/components/SectionHeading";
import SiteHeader from "@/components/SiteHeader";
import { getPublicDictionary } from "@/lib/content";
import { generateRoute } from "@/lib/content-model/route-registry";
import { PROJECT_COLLECTION_SEGMENTS, projectRouteCandidate } from "@/lib/content-model/project-routes";
import { LOCALES, SITE_URL } from "@/lib/i18n/config";
import { listPublishedProjects } from "@/lib/public-content/project";

const LOCALE = "en" as const;

function collectionUrl(locale: ContentLocale): string {
  const segment = PROJECT_COLLECTION_SEGMENTS[locale];
  return locale === "tr" ? `/${segment}` : `/${locale}/${segment}`;
}

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getPublicDictionary(LOCALE);
  const languages: Record<string, string> = {};
  for (const locale of LOCALES) languages[locale] = `${SITE_URL}${collectionUrl(locale)}`;
  languages["x-default"] = `${SITE_URL}${collectionUrl("tr")}`;
  return {
    title: dict.meta.projects.title,
    description: dict.meta.projects.description,
    alternates: { canonical: `${SITE_URL}${collectionUrl(LOCALE)}`, languages },
  };
}

export default async function ProjectsPage() {
  const [dict, projects] = await Promise.all([getPublicDictionary(LOCALE), listPublishedProjects(LOCALE)]);

  return <>
    <ScrollToTop />
    <SiteHeader locale={LOCALE} dict={dict} />
    <main>
      <PageBanner title={dict.projectsPage.banner} current={dict.projectsPage.banner} homeLabel={dict.common.home} homeHref={`/${LOCALE}`} />
      <section className="py-[120px]">
        <Reveal className="mx-auto max-w-7xl px-[15px]">
          <SectionHeading subtitle={dict.projectsPage.subtitle} title={dict.projectsPage.title} />
          <p className="mt-5 max-w-3xl text-lg leading-8 text-muted">{dict.projectsPage.intro}</p>
          {projects.length === 0 ? (
            <p className="mt-12 border border-hairline bg-base p-8 text-center text-muted shadow-card">{dict.projectsPage.empty}</p>
          ) : (
            <div className="mt-14 grid auto-rows-fr items-stretch gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map((project) => (
                <ProjectCard
                  key={project.entityId}
                  image={project.coverImage.url}
                  category={project.category}
                  title={project.title}
                  href={generateRoute(projectRouteCandidate(LOCALE, project.slug))}
                />
              ))}
            </div>
          )}
        </Reveal>
      </section>
    </main>
    <Footer locale={LOCALE} dict={dict} />
  </>;
}
