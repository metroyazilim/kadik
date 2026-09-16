import type { Metadata } from "next";
import { generateTermsMetadata, TermsPage } from "@/lib/public-pages/terms";

const LOCALE = "tr" as const;
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return generateTermsMetadata(LOCALE);
}

export default async function TurkishTermsPage() {
  return <TermsPage locale={LOCALE} />;
}
