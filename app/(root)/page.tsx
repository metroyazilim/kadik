import type { Metadata } from "next";
import { KadikHome } from "@/components/KadikSite";
import { listKadikPosts } from "@/lib/public-content/kadik-view";
import { listPublishedTeamMembers } from "@/lib/public-content/team";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "KADİK | Kybele Atasever Dünya İş Konseyi", description: "Kybele Atasever Dünya İş Konseyi; iş insanlarını, sektörleri ve uluslararası fırsatları ortak akılla buluşturur." };
export default async function TurkishHomePage() {
  const [team, posts] = await Promise.all([
    listPublishedTeamMembers("tr").catch(() => []),
    listKadikPosts("tr"),
  ]);
  return <KadikHome team={team} posts={posts} />;
}
