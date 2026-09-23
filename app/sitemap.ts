import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/i18n/config";
import { KADIK_CONTENT_KEYS, KADIK_PAGE_DEFINITIONS } from "@/lib/kadik-content/pages";
import { kadikPostPath } from "@/lib/kadik-i18n";
import { listPublishedPosts } from "@/lib/public-content/post";

export const dynamic = "force-dynamic";

const PRIORITY: Record<string, number> = { "/": 1, "/membership": 0.9, "/about": 0.8, "/board": 0.8, "/events": 0.8, "/news": 0.8 };

/**
 * The KADİK site only: every public page managed under "Sayfalar" plus each
 * published news article. Legacy starter-template routes are not listed.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages: MetadataRoute.Sitemap = KADIK_CONTENT_KEYS.flatMap((key) => {
    const path = KADIK_PAGE_DEFINITIONS[key].publicPath;
    if (!path || key === "notFound") return [];
    return [{ url: `${SITE_URL}${path === "/" ? "/" : path}`, changeFrequency: path === "/" || path === "/news" || path === "/events" ? "weekly" : "monthly", priority: PRIORITY[path] ?? 0.5 }];
  });
  const posts = await listPublishedPosts("en").catch(() => []);
  return [
    ...pages,
    ...posts.map((post) => ({ url: `${SITE_URL}${kadikPostPath("en", post.slug)}`, lastModified: post.publishedAt, changeFrequency: "monthly" as const, priority: 0.7 })),
  ];
}
