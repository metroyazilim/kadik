import type { Metadata } from "next";
import { BlogPostDetail, generateBlogPostMetadata } from "@/lib/public-pages/blog-post-detail";

const LOCALE = "tr" as const;
export const dynamic = "force-dynamic";
type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  return generateBlogPostMetadata(LOCALE, slug);
}

export default async function BlogPostPage({ params }: { params: Params }) {
  const { slug } = await params;
  return <BlogPostDetail locale={LOCALE} slug={slug} />;
}
