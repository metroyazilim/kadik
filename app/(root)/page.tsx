import type { Metadata } from "next";
import { generateHomeMetadata, HomePage } from "@/lib/public-pages/home";

const LOCALE = "tr" as const;
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return generateHomeMetadata(LOCALE);
}

export default async function TurkishHomePage() {
  return <HomePage locale={LOCALE} />;
}
