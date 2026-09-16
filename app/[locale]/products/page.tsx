import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getPublicDictionary } from "@/lib/content";
import { PRODUCT_COLLECTION_SEGMENTS } from "@/lib/content-model/product-routes";
import { alternatesFor, isLocale, type Locale } from "@/lib/i18n/config";

export const dynamic = "force-dynamic";
const NON_TR_LOCALES = ["en"] as const satisfies readonly Locale[];
export function generateStaticParams() { return NON_TR_LOCALES.map((locale) => ({ locale })); }

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale: value } = await params;
  if (!isLocale(value) || value === "tr") return {};
  const locale = value;
  const dict = await getPublicDictionary(locale);
  return { title: dict.meta.products.title, description: dict.meta.products.description, alternates: alternatesFor(locale, "/products") };
}

/**
 * Spec 6 cutover: Product is `RETIRED`, so this old English-word
 * `/<locale>/products` address has no legacy content left to render on
 * its own - it exists only to redirect to the real native collection
 * page. A `/tr/products` request never reaches this file (redirected by
 * next.config.ts); the explicit `notFound()` below is defense-in-depth
 * (AC-2.12).
 */
export default async function LocalizedProductsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: value } = await params;
  if (!isLocale(value) || value === "tr") notFound();
  const locale = value;
  redirect(`/${locale}/${PRODUCT_COLLECTION_SEGMENTS[locale]}`);
}
