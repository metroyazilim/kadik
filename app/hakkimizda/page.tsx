import type { Metadata } from "next";
import { AboutPage, generateAboutMetadata } from "@/lib/public-pages/about";

const LOCALE = "tr" as const;
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return generateAboutMetadata(LOCALE);
}

export default async function TurkishAboutPage() {
  return <AboutPage locale={LOCALE} />;
}
