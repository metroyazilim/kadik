import type { ContentLocale } from "@prisma/client";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import Footer from "@/components/Footer";
import { IconArrowRight } from "@/components/Icon";
import ScrollToTop from "@/components/ScrollToTop";
import PageBanner from "@/components/PageBanner";
import Reveal from "@/components/Reveal";
import SiteHeader from "@/components/SiteHeader";
import { ContentBlocks } from "@/components/public/ContentBlocks";
import { getPublicDictionary } from "@/lib/content";
import { generateRoute, type FallbackResolution } from "@/lib/content-model/route-registry";
import { PROJECT_COLLECTION_SEGMENTS, projectRouteCandidate } from "@/lib/content-model/project-routes";
import { composeSeoMetadata, buildHreflangAlternates } from "@/lib/content-model/public-seo";
import { getSiteSeoDefaults } from "@/lib/content-model/site-seo-defaults";
import { resolveFallbackAliasRedirect } from "@/lib/content-model/public-seo-redirect";
import { prisma } from "@/lib/db";
import { SITE_URL } from "@/lib/i18n/config";
import { getProjectAlternates, getPublishedProjectByRoute, listPublishedProjects } from "@/lib/public-content/project";

const LOCALE = "en" as const;
type Params = Promise<{ slug: string }>;

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const project = await getPublishedProjectByRoute(LOCALE, slug);
  if (!project) return {};

  const [alternateRoutes, defaults] = await Promise.all([
    getProjectAlternates(project.entityId),
    getSiteSeoDefaults(prisma, LOCALE),
  ]);
  const nativeUrlsByLocale = new Map(
    Object.entries(alternateRoutes).filter((entry): entry is [ContentLocale, string] => Boolean(entry[1])),
  );
  const languages: Record<string, string> = {};
  for (const alternate of buildHreflangAlternates(nativeUrlsByLocale)) {
    languages[alternate.locale] = `${SITE_URL}${alternate.url}`;
  }
  if (alternateRoutes.tr) languages["x-default"] = `${SITE_URL}${alternateRoutes.tr}`;

  const canonical = `${SITE_URL}${project.canonicalUrl}`;
  const route: FallbackResolution = project.noindex
    ? { kind: "fallback", url: canonical, canonical, noindex: true }
    : { kind: "native", url: canonical };
  const seo = composeSeoMetadata(
    route,
    {
      title: project.seoTitle ?? project.title,
      description: project.seoDescription ?? project.category,
      ogImageUrl: project.coverImage.isFallback ? undefined : project.coverImage.url,
    },
    defaults,
  );
  if (!seo) return {};

  return {
    title: seo.title,
    description: seo.description,
    alternates: { canonical: seo.canonical, languages },
    robots: seo.robots,
    openGraph: {
      title: seo.title,
      description: seo.description,
      ...(seo.ogTags.image ? { images: [seo.ogTags.image] } : {}),
    },
  };
}

export default async function ProjectPage({ params }: { params: Params }) {
  const { slug } = await params;
  const [dict, project, projects] = await Promise.all([
    getPublicDictionary(LOCALE),
    getPublishedProjectByRoute(LOCALE, slug),
    listPublishedProjects(LOCALE),
  ]);
  if (!project) {
    const legacy = await resolveFallbackAliasRedirect(prisma, LOCALE, PROJECT_COLLECTION_SEGMENTS[LOCALE], slug);
    if (legacy.kind === "redirect") permanentRedirect(legacy.url);
    notFound();
  }
  const copy = dict.projectDetailPage;

  const currentIndex = projects.findIndex((entry) => entry.entityId === project.entityId);
  const previous = currentIndex > 0 ? projects[currentIndex - 1] : null;
  const next = currentIndex >= 0 && currentIndex < projects.length - 1 ? projects[currentIndex + 1] : null;

  return <>
    <ScrollToTop />
    <SiteHeader locale={LOCALE} dict={dict} />
    <main>
      <PageBanner title={project.title} current={project.title} homeLabel={dict.common.home} homeHref={`/${LOCALE}`} />
      <Reveal as="article" className="mx-auto max-w-6xl px-[15px] py-[120px]">
        <img src={project.coverImage.url} alt={project.coverImage.altText} className="max-h-[620px] w-full rounded-[15px] object-cover" />

        <div className="relative z-10 mx-auto -mt-10 grid max-w-3xl gap-6 rounded-[15px] border border-hairline bg-base p-7 shadow-card sm:grid-cols-2 sm:p-9">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.12em] text-brand">{copy.categoryLabel}</p>
            <p className="mt-2 font-display text-2xl font-bold text-ink">{project.category}</p>
          </div>
          {project.client ? (
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.12em] text-brand">{copy.clientLabel}</p>
              <p className="mt-2 font-display text-2xl font-bold text-ink">{project.client}</p>
            </div>
          ) : null}
        </div>

        <div className="mx-auto mt-20 max-w-4xl space-y-16">
          <section>
            <h2 className="font-display text-4xl font-bold text-ink">{copy.challengeTitle}</h2>
            <ContentBlocks blocks={project.challengeBlocks} />
          </section>
          <section>
            <h2 className="font-display text-4xl font-bold text-ink">{copy.solutionTitle}</h2>
            <ContentBlocks blocks={project.solutionBlocks} />
          </section>
        </div>

        {project.gallery.length > 0 ? (
          <section className="mt-20">
            <h2 className="font-display text-4xl font-bold text-ink">{copy.galleryTitle}</h2>
            <div className="mt-8 grid gap-6 sm:grid-cols-2">
              {project.gallery.map((image, index) => (
                <img key={`${image.url}-${index}`} src={image.url} alt={image.altText} className="h-[360px] w-full rounded-[15px] object-cover" />
              ))}
            </div>
          </section>
        ) : null}

        <nav className="mt-20 grid gap-5 border-y border-hairline py-8 sm:grid-cols-2" aria-label={dict.projectsPage.title}>
          <div>
            {previous ? (
              <Link href={generateRoute(projectRouteCandidate(LOCALE, previous.slug))} className="group inline-flex items-center gap-3 font-display text-xl font-bold text-ink hover:text-brand">
                <IconArrowRight className="h-5 w-5 rotate-180 rtl:rotate-0" />{dict.common.prevProject}
              </Link>
            ) : null}
          </div>
          <div className="sm:text-end">
            {next ? (
              <Link href={generateRoute(projectRouteCandidate(LOCALE, next.slug))} className="group inline-flex items-center gap-3 font-display text-xl font-bold text-ink hover:text-brand">
                {dict.common.nextProject}<IconArrowRight className="h-5 w-5 rtl:rotate-180" />
              </Link>
            ) : null}
          </div>
        </nav>
        <Link href="/en/projects" className="mt-10 inline-flex bg-brand px-7 py-3 font-semibold text-base transition hover:bg-ink">{copy.backLabel}</Link>
      </Reveal>
    </main>
    <Footer locale={LOCALE} dict={dict} />
  </>;
}
