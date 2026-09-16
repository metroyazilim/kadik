import type { Metadata } from "next";
import { BlogList, generateBlogListMetadata } from "@/lib/public-pages/blog-list";

const LOCALE = "tr" as const;
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return generateBlogListMetadata(LOCALE);
}

export default async function BlogPage() {
  return <BlogList locale={LOCALE} />;
}
