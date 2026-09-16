import type { Metadata } from "next";
import { ContactPage, generateContactMetadata } from "@/lib/public-pages/contact";

const LOCALE = "tr" as const;
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return generateContactMetadata(LOCALE);
}

export default async function TurkishContactPage({
  searchParams,
}: {
  searchParams: Promise<{ subject?: string }>;
}) {
  const { subject = "" } = await searchParams;
  return <ContactPage locale={LOCALE} subjectPreset={subject.trim() || undefined} />;
}
