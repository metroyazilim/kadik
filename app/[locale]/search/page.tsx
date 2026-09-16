import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { generateSearchMetadata, SearchPage } from "@/lib/public-pages/search";
import { isLocale, type Locale } from "@/lib/i18n/config";

const NON_TR_LOCALES = ["en"] as const satisfies readonly Locale[];

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: value } = await params;
  if (!isLocale(value) || value === "tr") return {};
  return generateSearchMetadata(value);
}

/** Turkish Search is `/arama` (Spec 2); a `/tr/search` request never
 * reaches this file (redirected by next.config.ts), the explicit
 * `notFound()` below is defense-in-depth (AC-2.12). */
export default async function LocalizedSearch({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { locale: value } = await params;
  if (!isLocale(value) || value === "tr") notFound();
  const { q = "" } = await searchParams;
  return <SearchPage locale={value} q={q} />;
}
