import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { KadikPostDetail } from "@/components/KadikSite";
import { getKadikSiteContent } from "@/lib/kadik-content/store";
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
  const image = new URL(post.coverImage.url, SITE_URL).toString();
  return {
    title,
    description,
    alternates: { canonical },
    robots: post.noindex ? { index: false, follow: true } : undefined,
    openGraph: { type: "article", siteName: "KADİK London", locale: "en_GB", title, description, url: canonical, images: [{ url: image }] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default async function KadikPostPage({ params }: { params: Params }) {
  const { slug } = await params;
  const [post, { dict }] = await Promise.all([getKadikPost(LOCALE, slug), getKadikSiteContent()]);
  if (!post) notFound();
  return <KadikPostDetail locale={LOCALE} dict={dict} post={post} />;
}
