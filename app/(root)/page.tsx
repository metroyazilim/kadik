import type { Metadata } from "next";
import { KadikHome } from "@/components/KadikSite";
import { KadikJsonLd } from "@/components/KadikJsonLd";
import { getKadikSiteContent, kadikMetadata } from "@/lib/kadik-content/store";
import { kadikPageGraph } from "@/lib/kadik-content/structured-data";
import { listKadikPosts } from "@/lib/public-content/kadik-view";
import { listPublishedTeamMembers } from "@/lib/public-content/team";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return kadikMetadata("home");
}

export default async function EnglishHomePage() {
  const [{ dict, seo }, team, posts] = await Promise.all([
    getKadikSiteContent(),
    listPublishedTeamMembers("en").catch(() => []),
    listKadikPosts("en"),
  ]);
  return (
    <>
      <KadikJsonLd data={kadikPageGraph("home", dict, seo.home)} />
      <KadikHome locale="en" dict={dict} team={team} posts={posts} />
    </>
  );
}
