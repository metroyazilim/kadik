import type { Metadata } from "next";
import { generateSearchMetadata, SearchPage } from "@/lib/public-pages/search";

const LOCALE = "tr" as const;
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return generateSearchMetadata(LOCALE);
}

export default async function TurkishSearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  return <SearchPage locale={LOCALE} q={q} />;
}
