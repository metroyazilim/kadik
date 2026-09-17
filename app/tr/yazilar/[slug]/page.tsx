import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { KadikPostDetail } from "@/components/KadikSite";
import { getKadikPost } from "@/lib/public-content/kadik-view";
import { getPublishedPostByRoute } from "@/lib/public-content/post";

const LOCALE = "tr" as const;
export const dynamic = "force-dynamic";
type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPublishedPostByRoute(LOCALE, slug).catch(() => null);
  if (!post) return { title: "Yazı bulunamadı | KADİK" };
  return {
    title: `${post.seoTitle ?? post.title} | KADİK`,
    description: post.seoDescription ?? post.excerpt,
    alternates: { canonical: post.canonicalUrl },
    robots: post.noindex ? { index: false, follow: true } : undefined,
  };
}

export default async function KadikPostPage({ params }: { params: Params }) {
  const { slug } = await params;
  const post = await getKadikPost(LOCALE, slug);
  if (!post) notFound();
  return <KadikPostDetail locale={LOCALE} post={post} />;
}
