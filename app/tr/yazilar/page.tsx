import { KadikPosts } from "@/components/KadikSite";
import { listKadikPosts } from "@/lib/public-content/kadik-view";
export const dynamic = "force-dynamic";
export const metadata = { title: "Yayınlar | KADİK" };
export default async function PostsPage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const [{ category }, posts] = await Promise.all([searchParams, listKadikPosts("tr")]);
  return <KadikPosts locale="tr" key={category ?? "all"} posts={posts} initialCategory={category} />;
}
