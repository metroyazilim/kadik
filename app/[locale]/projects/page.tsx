import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getPublicDictionary } from "@/lib/content";
import { PROJECT_COLLECTION_SEGMENTS } from "@/lib/content-model/project-routes";
import { alternatesFor, isLocale, type Locale } from "@/lib/i18n/config";

export const dynamic = "force-dynamic";
const NON_TR_LOCALES = ["en"] as const satisfies readonly Locale[];

export function generateStaticParams() {
  return NON_TR_LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale: value } = await params;
  if (!isLocale(value) || value === "tr") return {};
  const locale = value;
  const dict = await getPublicDictionary(locale);
  return { title: dict.meta.projects.title, description: dict.meta.projects.description, alternates: alternatesFor(locale, "/projects") };
}

/**
 * Spec 6 cutover: Project is `RETIRED`, so this old English-word
 * `/<locale>/projects` address has no legacy content left to render on
 * its own - it exists only to redirect to the real native collection
 * page. A `/tr/projects` request never reaches this file (redirected by
 * next.config.ts); the explicit `notFound()` below is defense-in-depth
 * (AC-2.12).
 */
export default async function LocalizedProjects({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: value } = await params;
  if (!isLocale(value) || value === "tr") notFound();
  const locale = value;
  redirect(`/${locale}/${PROJECT_COLLECTION_SEGMENTS[locale]}`);
}
