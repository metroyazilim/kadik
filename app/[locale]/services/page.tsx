import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getPublicDictionary } from "@/lib/content";
import { SERVICE_COLLECTION_SEGMENTS } from "@/lib/content-model/service-routes";
import { alternatesFor, isLocale, type Locale } from "@/lib/i18n/config";

export const dynamic = "force-dynamic";
const NON_TR_LOCALES = ["en"] as const satisfies readonly Locale[];
export function generateStaticParams() { return NON_TR_LOCALES.map((locale) => ({ locale })); }

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale: value } = await params;
  if (!isLocale(value) || value === "tr") return {};
  const locale = value;
  const meta = (await getPublicDictionary(locale)).meta.services;
  return { title: meta.title, description: meta.description, alternates: alternatesFor(locale, "/services") };
}

/**
 * Spec 6 cutover: Service is `RETIRED` (read/write always resolve to the
 * CMS model), so this old English-word `/<locale>/services` address (a
 * pre-Spec-2 relic still reachable for `ru`/`ar`, which now have their own
 * native-script collection segment; `en`'s own literal `app/en/services`
 * folder already wins over this dynamic route for that locale) has no
 * legacy content left to render on its own - it exists only to redirect to
 * the real native collection page. A `/tr/services` request never reaches
 * this file (redirected by next.config.ts); the explicit `notFound()`
 * below is defense-in-depth (AC-2.12).
 */
export default async function LocalizedServices({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: value } = await params;
  if (!isLocale(value) || value === "tr") notFound();
  const locale = value;
  redirect(`/${locale}/${SERVICE_COLLECTION_SEGMENTS[locale]}`);
}
