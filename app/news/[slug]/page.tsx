import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { KadikPostDetail } from "@/components/KadikSite";
import { KadikJsonLd } from "@/components/KadikJsonLd";
import { getKadikSiteContent } from "@/lib/kadik-content/store";
import { kadikArticleGraph } from "@/lib/kadik-content/structured-data";
import { getKadikPost } from "@/lib/public-content/kadik-view";
import { getPublishedPostByRoute } from "@/lib/public-content/post";
import { SITE_URL } from "@/lib/i18n/config";
import { kadikPostPath } from "@/lib/kadik-i18n";

const LOCALE = "en" as const;
export const dynamic = "force-dynamic";
type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPublishedPostByRoute(LOCALE, slug).catch(() => null);
  if (!post) return { title: "Article not found | KADİK" };
  // An SEO title from the admin SEO screen is used verbatim; otherwise the article title gets the brand suffix.
  const title = post.seoTitle?.trim() || `${post.title} | KADİK`;
  const description = post.seoDescription?.trim() || post.excerpt;
  const canonical = new URL(kadikPostPath(LOCALE, slug), SITE_URL).toString();
  return {
    title,
    description,
    alternates: { canonical },
    robots: post.noindex ? { index: false, follow: true } : undefined,
    // The share image comes from ./opengraph-image.tsx (branded card with the article title).
    openGraph: {
      type: "article",
      siteName: "KADİK London",
      locale: "en_GB",
      title,
      description,
      url: canonical,
      publishedTime: post.publishedAt.toISOString(),
      authors: post.author ? [post.author] : undefined,
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function KadikPostPage({ params }: { params: Params }) {
  const { slug } = await params;
  const [post, detail, { dict }] = await Promise.all([
    getKadikPost(LOCALE, slug),
    getPublishedPostByRoute(LOCALE, slug).catch(() => null),
    getKadikSiteContent(),
  ]);
  if (!post || !detail) notFound();
  const article = kadikArticleGraph(dict, {
    slug,
    title: detail.seoTitle?.trim() || detail.title,
    description: detail.seoDescription?.trim() || detail.excerpt,
    image: detail.coverImage.url,
    publishedAt: detail.publishedAt,
    author: detail.author,
    category: detail.category,
  });
  return (
    <>
      <KadikJsonLd data={article} />
      <KadikPostDetail locale={LOCALE} dict={dict} post={post} />
    </>
  );
}
