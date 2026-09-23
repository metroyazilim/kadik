import type { Metadata } from "next";
import { KadikHome } from "@/components/KadikSite";
import { getKadikSiteContent, kadikMetadata } from "@/lib/kadik-content/store";
import { listKadikPosts } from "@/lib/public-content/kadik-view";
import { listPublishedTeamMembers } from "@/lib/public-content/team";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return kadikMetadata("home");
}

export default async function EnglishHomePage() {
  const [{ dict }, team, posts] = await Promise.all([
    getKadikSiteContent(),
    listPublishedTeamMembers("en").catch(() => []),
    listKadikPosts("en"),
  ]);
  return <KadikHome locale="en" dict={dict} team={team} posts={posts} />;
}
