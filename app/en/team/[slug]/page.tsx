import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";
import { TeamMemberDetail, generateTeamMemberMetadata } from "@/lib/public-pages/team-member-detail";

const LOCALE = "en" as const;
export const dynamic = "force-dynamic";
type Params = Promise<{ slug: string }>;

export function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  return params.then(({ slug }) => generateTeamMemberMetadata(LOCALE, slug));
}

export default async function EnglishTeamMemberPage({ params }: { params: Params }) {
  const { slug } = await params;
  if (slug === "bob-farmer") permanentRedirect("/board/bob-farmer");
  return <TeamMemberDetail locale={LOCALE} slug={slug} />;
}
