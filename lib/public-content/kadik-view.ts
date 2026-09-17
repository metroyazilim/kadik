import "server-only";
import type { ContentLocale } from "@prisma/client";
import type { KadikArticleBlock, KadikPostDetailData, KadikPostListItem } from "@/components/KadikSite";
import type { PublicContentBlock } from "./content-blocks";
import { getPublishedPostByRoute, listPublishedPosts, type PublicPostListItem } from "./post";

/**
 * KADİK public yüzeyinin (istemci bileşeni `components/KadikSite.tsx`)
 * tükettiği tek projeksiyon katmanı. Yayınlanmış `post` revizyonlarını
 * serileştirilebilir, asset id'si taşımayan bir şekle indirger: `KadikSite`
 * bir Prisma tipi, `ResolvedPublicMedia` nesnesi veya `MediaAsset` kimliği
 * görmez, yalnızca çözülmüş URL ve biçimlenmiş tarih alır.
 */

const DATE_FORMAT: Readonly<Intl.DateTimeFormatOptions> = { day: "numeric", month: "long", year: "numeric" };
const DATE_TAG: Record<ContentLocale, string> = { en: "en-GB", tr: "tr-TR" };

function toListItem(post: PublicPostListItem, locale: ContentLocale): KadikPostListItem {
  return {
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt,
    category: post.category,
    dateLabel: post.publishedAt.toLocaleDateString(DATE_TAG[locale], DATE_FORMAT),
    image: post.coverImage.url,
  };
}

function toArticleBlock(block: PublicContentBlock): KadikArticleBlock {
  switch (block.type) {
    case "text":
      return { type: "text", html: block.html };
    case "image":
      return { type: "image", url: block.image.url, caption: block.caption };
    case "kpi":
      return { type: "kpi", heading: block.heading, items: block.items };
    case "quote":
      return { type: "quote", text: block.text, author: block.author };
    case "banner":
      return { type: "banner", heading: block.heading, text: block.text, ctaLabel: block.ctaLabel, ctaUrl: block.ctaUrl };
  }
}

export async function listKadikPosts(locale: ContentLocale): Promise<KadikPostListItem[]> {
  const posts = await listPublishedPosts(locale).catch(() => []);
  return posts.map((post) => toListItem(post, locale));
}

export async function getKadikPost(locale: ContentLocale, slug: string): Promise<KadikPostDetailData | null> {
  const post = await getPublishedPostByRoute(locale, slug).catch(() => null);
  if (!post) return null;
  return { ...toListItem(post, locale), author: post.author, blocks: post.blocks.map(toArticleBlock) };
}

