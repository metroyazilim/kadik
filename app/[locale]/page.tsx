import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { generateHomeMetadata, HomePage } from "@/lib/public-pages/home";
import { isLocale, type Locale } from "@/lib/i18n/config";

const NON_TR_LOCALES = ["en"] as const satisfies readonly Locale[];

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return NON_TR_LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale: value } = await params;
  if (!isLocale(value) || value === "tr") return {};
  return generateHomeMetadata(value);
}

/** Turkish home is prefixless; this segment only serves Global English.
 * `/tr` is redirected before the app router, with this guard retained as
 * defense in depth. */
export default async function LocalizedHome({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: value } = await params;
  if (!isLocale(value) || value === "tr") notFound();
  return <HomePage locale={value} />;
}
