import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { generateTermsMetadata, TermsPage } from "@/lib/public-pages/terms";
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
  return generateTermsMetadata(value);
}

/** Turkish Terms is `/kullanim-sartlari` (Spec 2); a `/tr/terms` request
 * never reaches this file (redirected by next.config.ts), the explicit
 * `notFound()` below is defense-in-depth (AC-2.12). */
export default async function LocalizedTerms({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: value } = await params;
  if (!isLocale(value) || value === "tr") notFound();
  return <TermsPage locale={value} />;
}
