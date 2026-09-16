import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getPublishedRouteCandidates } from "@/lib/content-model/route-reader";
import { resolvePublicRoute } from "@/lib/content-model/route-registry";
import { findPublishedEntityByRoute } from "@/lib/content-model/service-route-lookup";
import { SERVICE_COLLECTION_SEGMENTS } from "@/lib/content-model/service-routes";
import { prisma } from "@/lib/db";
import { alternatesFor, isLocale, type Locale } from "@/lib/i18n/config";
import { getPublishedServiceByRoute } from "@/lib/public-content/service";

type Params = Promise<{ locale: string; slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale: value, slug } = await params;
  if (!isLocale(value) || value === "tr") return {};
  const locale = value as Locale;
  const service = await getPublishedServiceByRoute(locale, slug);
  if (!service) return {};
  return {
    title: service.title,
    description: service.summary,
    alternates: alternatesFor(locale, `/services/${service.slug}`),
    openGraph: { title: service.title, description: service.summary },
  };
}

/**
 * Spec 6 cutover: Service is `RETIRED`, so this old English-word
 * `/<locale>/services/<slug>` address (a pre-Spec-2 relic still reachable
 * for `ru`/`ar`) has no legacy content of its own - it exists only to
 * redirect to the real native detail route, or 404 if the slug does not
 * resolve to a published entity at all. A `/tr/services/<slug>` request
 * never reaches this file (redirected by next.config.ts); the explicit
 * `notFound()` below is defense-in-depth (AC-2.12).
 */
export default async function LocalizedService({ params }: { params: Params }) {
  const { locale: value, slug } = await params;
  if (!isLocale(value) || value === "tr") notFound();
  const locale = value;
  const found = await findPublishedEntityByRoute(prisma, locale, SERVICE_COLLECTION_SEGMENTS[locale], slug);
  if (!found) notFound();
  const routes = await getPublishedRouteCandidates(prisma, found.entityId);
  const resolved = resolvePublicRoute(found.entityId, locale, routes);
  if (resolved.kind === "notFound") notFound();
  redirect(resolved.url);
}
