import { KadikPosts } from "@/components/KadikSite";
import { listKadikPosts } from "@/lib/public-content/kadik-view";
export const dynamic = "force-dynamic";
export const metadata = { title: "News | KADİK" };
export default async function NewsPage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const [{ category }, posts] = await Promise.all([searchParams, listKadikPosts("en")]);
  return <KadikPosts locale="en" key={category ?? "all"} posts={posts} initialCategory={category} />;
}
