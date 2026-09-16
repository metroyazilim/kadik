import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getPublishedRouteCandidates } from "@/lib/content-model/route-reader";
import { resolvePublicRoute } from "@/lib/content-model/route-registry";
import { findPublishedProjectByRoute } from "@/lib/content-model/project-route-lookup";
import { PROJECT_COLLECTION_SEGMENTS } from "@/lib/content-model/project-routes";
import { prisma } from "@/lib/db";
import { alternatesFor, isLocale, type Locale } from "@/lib/i18n/config";
import { getPublishedProjectByRoute } from "@/lib/public-content/project";

type Params = Promise<{ locale: string; slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale: value, slug } = await params;
  if (!isLocale(value) || value === "tr") return {};
  const locale = value as Locale;
  const project = await getPublishedProjectByRoute(locale, slug);
  if (!project) return {};
  return {
    title: project.title,
    description: project.category,
    alternates: alternatesFor(locale, `/projects/${project.slug}`),
    openGraph: { title: project.title, description: project.category },
  };
}

/**
 * Spec 6 cutover: Project is `RETIRED`, so this old English-word
 * `/<locale>/projects/<slug>` address has no legacy content of its own -
 * it exists only to redirect to the real native detail route, or 404 if
 * the slug does not resolve to a published entity at all. A
 * `/tr/projects/<slug>` request never reaches this file (redirected by
 * next.config.ts); the explicit `notFound()` below is defense-in-depth
 * (AC-2.12).
 */
export default async function LocalizedProject({ params }: { params: Params }) {
  const { locale: value, slug } = await params;
  if (!isLocale(value) || value === "tr") notFound();
  const locale = value;
  const found = await findPublishedProjectByRoute(prisma, locale, PROJECT_COLLECTION_SEGMENTS[locale], slug);
  if (!found) notFound();
  const routes = await getPublishedRouteCandidates(prisma, found.entityId);
  const resolved = resolvePublicRoute(found.entityId, locale, routes);
  if (resolved.kind === "notFound") notFound();
  redirect(resolved.url);
}
