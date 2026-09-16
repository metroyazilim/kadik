import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getPublishedRouteCandidates } from "@/lib/content-model/route-reader";
import { resolvePublicRoute } from "@/lib/content-model/route-registry";
import { findPublishedPostByRoute } from "@/lib/content-model/post-route-lookup";
import { POST_COLLECTION_SEGMENTS } from "@/lib/content-model/post-routes";
import { prisma } from "@/lib/db";
import { alternatesFor, isLocale, type Locale } from "@/lib/i18n/config";
import { getPublishedPostByRoute } from "@/lib/public-content/post";

type Params = Promise<{ locale: string; slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale: value, slug } = await params;
  if (!isLocale(value) || value === "tr") return {};
  const locale = value as Locale;
  const post = await getPublishedPostByRoute(locale, slug);
  if (!post) return {};
  return {
    title: `${post.title} | Metro Yazılım`,
    description: post.excerpt,
    alternates: alternatesFor(locale, `/blog/${post.slug}`),
    openGraph: { title: post.title, description: post.excerpt },
  };
}

/**
 * Spec 6 cutover: Post is `RETIRED`, so this old `/<locale>/blog/<slug>`
 * address has no legacy content of its own - it exists only to redirect
 * to the real native detail route, or 404 if the slug does not resolve to
 * a published entity at all. A `/tr/blog/<slug>` request never reaches
 * this file (redirected by next.config.ts); the explicit `notFound()`
 * below is defense-in-depth (AC-2.12).
 */
export default async function LocalizedPost({ params }: { params: Params }) {
  const { locale: value, slug } = await params;
  if (!isLocale(value) || value === "tr") notFound();
  const locale = value;
  const found = await findPublishedPostByRoute(prisma, locale, POST_COLLECTION_SEGMENTS[locale], slug);
  if (!found) notFound();
  const routes = await getPublishedRouteCandidates(prisma, found.entityId);
  const resolved = resolvePublicRoute(found.entityId, locale, routes);
  if (resolved.kind === "notFound") notFound();
  redirect(resolved.url);
}
