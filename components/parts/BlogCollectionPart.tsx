import Reveal from "@/components/Reveal";
import SectionHeading from "@/components/SectionHeading";
import BlogCard from "@/components/BlogCard";
import type { Locale } from "@/lib/i18n/config";
import { DUMMY_BLOG_IMAGES, dummyImage } from "@/lib/media/dummy-images";
import { CollectionLayout } from "./CollectionLayout";

export type BlogItem = Readonly<{
  title: string;
  category: string;
  author: string;
  day: string;
  month: string;
  image?: string | null;
  href: string;
}>;

export type BlogCollectionPartProps = Readonly<{
  locale: Locale;
  subtitle?: string;
  title?: string;
  items?: readonly BlogItem[];
  layout?: "grid" | "carousel";
  columns?: 2 | 3 | 4;
  limit?: number;
  readMoreLabel?: string;
}>;

export function BlogCollectionPart({
  subtitle = "",
  title = "",
  items,
  layout = "grid",
  columns = 3,
  limit = 3,
  readMoreLabel = "",
}: BlogCollectionPartProps) {
  if (!items || items.length === 0) return null;
  const displayPosts = items.slice(0, limit);

  return (
    <section id="blog" className="pb-[200px] pt-[120px]">
      <Reveal className="mx-auto max-w-7xl px-[15px]">
        <SectionHeading subtitle={subtitle} title={title} />
        <CollectionLayout mode={layout} columns={columns} count={displayPosts.length}>
          {displayPosts.map((post, index) => (
            <BlogCard
              key={post.title}
              image={post.image || dummyImage(DUMMY_BLOG_IMAGES, index)}
              day={post.day}
              month={post.month}
              author={post.author}
              category={post.category}
              title={post.title}
              readMore={readMoreLabel}
              href={post.href}
            />
          ))}
        </CollectionLayout>
      </Reveal>
    </section>
  );
}
