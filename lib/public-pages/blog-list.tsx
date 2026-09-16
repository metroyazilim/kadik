import type { ContentLocale } from "@prisma/client";
import type { Metadata } from "next";
import BlogCard from "@/components/BlogCard";
import Footer from "@/components/Footer";
import ScrollToTop from "@/components/ScrollToTop";
import PageBanner from "@/components/PageBanner";
import Reveal from "@/components/Reveal";
import SectionHeading from "@/components/SectionHeading";
import SiteHeader from "@/components/SiteHeader";
import ThemeButton from "@/components/ThemeButton";
import { getPublicDictionary } from "@/lib/content";
import { generateRoute } from "@/lib/content-model/route-registry";
import { postRouteCandidate } from "@/lib/content-model/post-routes";
import { alternatesFor, type Locale } from "@/lib/i18n/config";
import { listPublishedPosts } from "@/lib/public-content/post";

import { DUMMY_BLOG_IMAGES, dummyImage } from "@/lib/media/dummy-images";

export async function generateBlogListMetadata(locale: ContentLocale): Promise<Metadata> {
  const dict = await getPublicDictionary(locale as Locale);
  return { title: dict.meta.blog.title, description: dict.meta.blog.description, alternates: alternatesFor(locale as Locale, "/blog") };
}

/**
 * Shared collection listing consumed by every locale's thin `/blog` (and
 * `/en/blog`) native route page - mirrors
 * `TeamMemberDetail`'s one-shared-component-per-surface pattern rather than
 * duplicating this markup four times per Service/Product's older approach.
 * An empty published collection renders a safe, accessible empty state
 * instead of the checked-in dictionary's placeholder posts (Story 3.4:
 * "yayınlanmamış draft veya admin placeholder public'e sızmaz").
 */
export async function BlogList({ locale }: { locale: ContentLocale }) {
  const [dict, posts] = await Promise.all([getPublicDictionary(locale as Locale), listPublishedPosts(locale)]);
  const homeHref = locale === "tr" ? "/" : `/${locale}`;

  return (
    <>
      <ScrollToTop />
      <SiteHeader locale={locale as Locale} dict={dict} />
      <main>
        <PageBanner title={dict.blog.title} current={dict.blog.title} homeLabel={dict.common.home} homeHref={homeHref} />
        <section className="py-[120px]">
          <Reveal className="mx-auto max-w-7xl px-[15px]">
            <div className="flex flex-wrap items-end justify-between gap-6">
              <SectionHeading subtitle={dict.blog.subtitle} title={dict.blog.title} />
              <ThemeButton href={homeHref}>{dict.common.home}</ThemeButton>
            </div>
            {posts.length === 0 ? (
              <p role="status" className="mt-14 rounded-lg border border-hairline bg-base p-10 text-center text-lg text-muted">
                {dict.blog.title} — henüz yayınlanmış yazı yok.
              </p>
            ) : (
              <div
                className={`mt-14 grid auto-rows-fr items-stretch gap-8 ${
                  posts.length <= 2 ? "md:grid-cols-2" : "md:grid-cols-2 lg:grid-cols-3"
                }`}
              >
                {posts.map((post, index) => (
                  <BlogCard
                    key={post.entityId}
                    image={post.coverImage.isFallback ? dummyImage(DUMMY_BLOG_IMAGES, index) : post.coverImage.url}
                    day={new Intl.DateTimeFormat(locale, { day: "2-digit", timeZone: "UTC" }).format(post.publishedAt)}
                    month={new Intl.DateTimeFormat(locale, { month: "short", timeZone: "UTC" }).format(post.publishedAt)}
                    author={post.author}
                    category={post.category}
                    title={post.title}
                    readMore={dict.common.readMore}
                    href={generateRoute(postRouteCandidate(locale, post.slug))}
                  />
                ))}
              </div>
            )}
          </Reveal>
        </section>
      </main>
      <Footer locale={locale as Locale} dict={dict} />
    </>
  );
}
