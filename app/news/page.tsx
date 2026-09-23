import type { Metadata } from "next";
import { KadikPosts } from "@/components/KadikSite";
import { getKadikSiteContent, kadikMetadata } from "@/lib/kadik-content/store";
import { listKadikPosts } from "@/lib/public-content/kadik-view";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return kadikMetadata("news");
}

export default async function NewsPage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const [{ category }, { dict }, posts] = await Promise.all([searchParams, getKadikSiteContent(), listKadikPosts("en")]);
  return <KadikPosts locale="en" dict={dict} key={category ?? "all"} posts={posts} initialCategory={category} />;
}
