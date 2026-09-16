import type { Metadata } from "next";
import { FaqPage, generateFaqMetadata } from "@/lib/public-pages/faq";

const LOCALE = "tr" as const;
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return generateFaqMetadata(LOCALE);
}

export default async function TurkishFaqPage() {
  return <FaqPage locale={LOCALE} />;
}
