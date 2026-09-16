import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FaqPage, generateFaqMetadata } from "@/lib/public-pages/faq";
import { isLocale, type Locale } from "@/lib/i18n/config";

const NON_TR_LOCALES = ["en"] as const satisfies readonly Locale[];

export const dynamic = "force-dynamic";
export function generateStaticParams() {
  return NON_TR_LOCALES.map((locale) => ({ locale }));
}

type Params = Promise<{ locale: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale: value } = await params;
  if (!isLocale(value) || value === "tr") return {};
  return generateFaqMetadata(value);
}

/** Turkish FAQ is `/sss` (Spec 2); a `/tr/faq` request never reaches this
 * file (redirected by next.config.ts), the explicit `notFound()` below is
 * defense-in-depth (AC-2.12). */
export default async function LocalizedFaqPage({ params }: { params: Params }) {
  const { locale: value } = await params;
  if (!isLocale(value) || value === "tr") notFound();
  return <FaqPage locale={value} />;
}
