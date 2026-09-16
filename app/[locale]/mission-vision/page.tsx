import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { generateMissionVisionMetadata, MissionVisionPage } from "@/lib/public-pages/mission-vision";
import { isLocale, type Locale } from "@/lib/i18n/config";

const NON_TR_LOCALES = ["en"] as const satisfies readonly Locale[];

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return NON_TR_LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: value } = await params;
  if (!isLocale(value) || value === "tr") return {};
  return generateMissionVisionMetadata(value);
}

/** Turkish Mission & Vision is `/misyon-vizyon` (Spec 2); a
 * `/tr/mission-vision` request never reaches this file (redirected by
 * next.config.ts), the explicit `notFound()` below is defense-in-depth
 * (AC-2.12). */
export default async function LocalizedMissionVision({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: value } = await params;
  if (!isLocale(value) || value === "tr") notFound();
  return <MissionVisionPage locale={value} />;
}
