import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getPublicDictionary } from "@/lib/content";
import { POST_COLLECTION_SEGMENTS } from "@/lib/content-model/post-routes";
import { alternatesFor, isLocale, type Locale } from "@/lib/i18n/config";

export const dynamic = "force-dynamic";
const NON_TR_LOCALES = ["en"] as const satisfies readonly Locale[];
export function generateStaticParams() { return NON_TR_LOCALES.map((locale) => ({ locale })); }

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale: value } = await params;
  if (!isLocale(value) || value === "tr") return {};
  const locale = value;
  const dict = await getPublicDictionary(locale);
  return { title: dict.blog.title, description: dict.meta.home.description, alternates: alternatesFor(locale, "/blog") };
}

/**
 * Spec 6 cutover: Post is `RETIRED`, so this old `/<locale>/blog` address
 * (reachable for `ru`/`ar`, whose native blog segment differs; `en`'s own
 * literal `app/en/blog` folder already wins over this dynamic route) has
 * no legacy content left to render on its own - it exists only to
 * redirect to the real native collection page. A `/tr/blog` request never
 * reaches this file (redirected by next.config.ts); the explicit
 * `notFound()` below is defense-in-depth (AC-2.12).
 */
export default async function LocalizedBlog({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: value } = await params;
  if (!isLocale(value) || value === "tr") notFound();
  const locale = value;
  redirect(`/${locale}/${POST_COLLECTION_SEGMENTS[locale]}`);
}
