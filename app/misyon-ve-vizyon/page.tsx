import type { Metadata } from "next";
import { generateMissionVisionMetadata, MissionVisionPage } from "@/lib/public-pages/mission-vision";

const LOCALE = "tr" as const;
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return generateMissionVisionMetadata(LOCALE);
}

export default async function TurkishMissionVisionPage() {
  return <MissionVisionPage locale={LOCALE} />;
}
