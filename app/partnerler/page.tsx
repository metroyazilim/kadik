import type { Metadata } from "next";
import { generatePartnersMetadata, PartnersPage } from "@/lib/public-pages/partners";

const LOCALE = "tr" as const;
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return generatePartnersMetadata(LOCALE);
}

export default async function TurkishPartnersPage() {
  return <PartnersPage locale={LOCALE} />;
}
