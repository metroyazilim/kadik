import type { Metadata } from "next";
import { KadikHome } from "@/components/KadikSite";
import { listKadikPosts } from "@/lib/public-content/kadik-view";
import { listPublishedTeamMembers } from "@/lib/public-content/team";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "KADİK London | Kybele Atasever World Business Council", description: "Kybele Atasever World Business Council brings business people, sectors and international opportunities together through shared judgement." };
export default async function EnglishHomePage() {
  const [team, posts] = await Promise.all([
    listPublishedTeamMembers("en").catch(() => []),
    listKadikPosts("en"),
  ]);
  return <KadikHome locale="en" team={team} posts={posts} />;
}
