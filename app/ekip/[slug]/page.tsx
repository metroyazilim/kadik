import type { Metadata } from "next";
import { TeamMemberDetail, generateTeamMemberMetadata } from "@/lib/public-pages/team-member-detail";

const LOCALE = "tr" as const;
export const dynamic = "force-dynamic";
type Params = Promise<{ slug: string }>;

export function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  return params.then(({ slug }) => generateTeamMemberMetadata(LOCALE, slug));
}

export default async function TurkishTeamMemberPage({ params }: { params: Params }) {
  const { slug } = await params;
  return <TeamMemberDetail locale={LOCALE} slug={slug} />;
}
