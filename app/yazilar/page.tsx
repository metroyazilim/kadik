import { KadikPosts } from "@/components/KadikSite";
export const metadata = { title: "Yazılar | KADIK" };
export default async function PostsPage({ searchParams }: { searchParams: Promise<{ kategori?: string }> }) {
  const { kategori } = await searchParams;
  return <KadikPosts key={kategori ?? "all"} initialCategory={kategori} />;
}
