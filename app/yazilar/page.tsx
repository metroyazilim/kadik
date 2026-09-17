import { KadikPosts } from "@/components/KadikSite";
import { listKadikPosts } from "@/lib/public-content/kadik-view";
export const dynamic = "force-dynamic";
export const metadata = { title: "Yayınlar | KADİK" };
export default async function PostsPage({ searchParams }: { searchParams: Promise<{ kategori?: string }> }) {
  const [{ kategori }, posts] = await Promise.all([searchParams, listKadikPosts("tr")]);
  return <KadikPosts key={kategori ?? "all"} posts={posts} initialCategory={kategori} />;
}
