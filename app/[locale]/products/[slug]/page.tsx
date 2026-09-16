import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getPublishedRouteCandidates } from "@/lib/content-model/route-reader";
import { resolvePublicRoute } from "@/lib/content-model/route-registry";
import { findPublishedProductByRoute } from "@/lib/content-model/product-route-lookup";
import { PRODUCT_COLLECTION_SEGMENTS } from "@/lib/content-model/product-routes";
import { prisma } from "@/lib/db";
import { alternatesFor, isLocale, type Locale } from "@/lib/i18n/config";
import { getPublishedProductByRoute } from "@/lib/public-content/product";

type Params = Promise<{ locale: string; slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale: value, slug } = await params;
  if (!isLocale(value) || value === "tr") return {};
  const locale = value as Locale;
  const product = await getPublishedProductByRoute(locale, slug);
  if (!product) return {};
  return {
    title: product.title,
    description: product.summary,
    alternates: alternatesFor(locale, `/products/${product.slug}`),
    openGraph: { title: product.title, description: product.summary },
  };
}

/**
 * Spec 6 cutover: Product is `RETIRED`, so this old English-word
 * `/<locale>/products/<slug>` address has no legacy content of its own -
 * it exists only to redirect to the real native detail route, or 404 if
 * the slug does not resolve to a published entity at all. A
 * `/tr/products/<slug>` request never reaches this file (redirected by
 * next.config.ts); the explicit `notFound()` below is defense-in-depth
 * (AC-2.12).
 */
export default async function LocalizedProductDetailPage({ params }: { params: Params }) {
  const { locale: value, slug } = await params;
  if (!isLocale(value) || value === "tr") notFound();
  const locale = value;
  const found = await findPublishedProductByRoute(prisma, locale, PRODUCT_COLLECTION_SEGMENTS[locale], slug);
  if (!found) notFound();
  const routes = await getPublishedRouteCandidates(prisma, found.entityId);
  const resolved = resolvePublicRoute(found.entityId, locale, routes);
  if (resolved.kind === "notFound") notFound();
  redirect(resolved.url);
}
