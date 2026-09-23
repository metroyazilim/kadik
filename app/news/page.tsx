import type { Metadata } from "next";
import { KadikPosts } from "@/components/KadikSite";
import { KadikJsonLd } from "@/components/KadikJsonLd";
import { getKadikSiteContent, kadikMetadata } from "@/lib/kadik-content/store";
import { kadikPageGraph } from "@/lib/kadik-content/structured-data";
import { listKadikPosts } from "@/lib/public-content/kadik-view";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return kadikMetadata("news");
}

export default async function NewsPage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const [{ category }, { dict, seo }, posts] = await Promise.all([searchParams, getKadikSiteContent(), listKadikPosts("en")]);
  return (
    <>
      <KadikJsonLd data={kadikPageGraph("news", dict, seo.news, { posts: posts.map((post) => ({ slug: post.slug, title: post.title })) })} />
      <KadikPosts locale="en" dict={dict} key={category ?? "all"} posts={posts} initialCategory={category} />
    </>
  );
}
