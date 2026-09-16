import type { Metadata } from "next";
import { generatePrivacyMetadata, PrivacyPage } from "@/lib/public-pages/privacy";

const LOCALE = "tr" as const;
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return generatePrivacyMetadata(LOCALE);
}

export default async function TurkishPrivacyPage() {
  return <PrivacyPage locale={LOCALE} />;
}
