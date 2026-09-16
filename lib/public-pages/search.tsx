import type { ContentLocale } from "@prisma/client";
import type { Metadata } from "next";
import Link from "next/link";
import Footer from "@/components/Footer";
import ScrollToTop from "@/components/ScrollToTop";
import PageBanner from "@/components/PageBanner";
import Reveal from "@/components/Reveal";
import SiteHeader from "@/components/SiteHeader";
import { getPublicDictionary } from "@/lib/content";
import type { Locale } from "@/lib/i18n/config";
import { staticAlternates, staticPath } from "@/lib/i18n/static-pages";
import { pathForNavKey } from "@/lib/public-content/site-shell-view";
import { listPublishedPosts } from "@/lib/public-content/post";
import { listPublishedProducts } from "@/lib/public-content/product";
import { listPublishedProjects } from "@/lib/public-content/project";
import { listPublishedServices } from "@/lib/public-content/service";
import { listPublishedTeamMembers } from "@/lib/public-content/team";

type SearchResult = {
  id: string;
  href: string;
  title: string;
  label: string;
};

type ResultSectionProps = {
  title: string;
  items: SearchResult[];
};

function ResultSection({ title, items }: ResultSectionProps) {
  if (items.length === 0) return null;
  return (
    <section>
      <h2 className="font-display text-[28px] font-bold text-ink">{title}</h2>
      <div className="mt-5 divide-y divide-hairline border border-hairline bg-base shadow-card">
        {items.map((item) => (
          <Link key={item.id} href={item.href} className="block px-6 py-5 transition-colors hover:bg-[#f7f8ff]">
            <h3 className="font-display text-xl font-semibold text-ink">{item.title}</h3>
            <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted">{item.label}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}

/** Turkish's own collection segments are prefixless native-script (Spec 2);
 * `en`/`ru`/`ar` keep their pre-existing `/${locale}/<englishSegment>/<slug>`
 * link exactly as before - fixing their native-script segment mismatch is
 * out of this spec's scope (see spec-2.md \u00a73.2). */
function resultHref(
  locale: Locale,
  key: "blog" | "services" | "products" | "projects" | "team",
  englishSegment: string,
  slug: string,
): string {
  if (locale === "tr") return `${pathForNavKey("tr", key)}/${slug}`;
  return `/${locale}/${englishSegment}/${slug}`;
}

export async function generateSearchMetadata(locale: Locale): Promise<Metadata> {
  const meta = (await getPublicDictionary(locale)).meta.search;
  return {
    title: meta.title,
    description: meta.description,
    alternates: staticAlternates(locale, "search"),
  };
}

/**
 * Shared Search body consumed by every locale's thin `/arama` (and
 * `/en/search`) route file.
 */
export async function SearchPage({ locale, q }: { locale: Locale; q: string }) {
  const dict = await getPublicDictionary(locale);
  const query = q.trim();

  let postResults: SearchResult[] = [];
  let serviceResults: SearchResult[] = [];
  let productResults: SearchResult[] = [];
  let projectResults: SearchResult[] = [];
  let teamResults: SearchResult[] = [];

  if (query) {
    const [posts, services, products, projects, teamMembers] = await Promise.all([
      listPublishedPosts(locale as ContentLocale),
      listPublishedServices(locale as ContentLocale),
      listPublishedProducts(locale as ContentLocale),
      listPublishedProjects(locale as ContentLocale),
      listPublishedTeamMembers(locale as ContentLocale),
    ]);
    const needle = query.toLowerCase();
    postResults = posts
      .filter((post) => post.title.toLowerCase().includes(needle) || post.excerpt.toLowerCase().includes(needle))
      .map((post) => ({ id: post.entityId, href: resultHref(locale, "blog", "blog", post.slug), title: post.title, label: post.excerpt }));
    serviceResults = services
      .filter((service) => service.title.toLowerCase().includes(needle) || service.summary.toLowerCase().includes(needle))
      .map((service) => ({ id: service.entityId, href: resultHref(locale, "services", "services", service.slug), title: service.title, label: service.summary }));
    productResults = products
      .filter((product) => product.title.toLowerCase().includes(needle) || product.summary.toLowerCase().includes(needle))
      .map((product) => ({ id: product.entityId, href: resultHref(locale, "products", "products", product.slug), title: product.title, label: product.summary }));
    projectResults = projects
      .filter((project) => project.title.toLowerCase().includes(needle) || project.category.toLowerCase().includes(needle))
      .map((project) => ({ id: project.entityId, href: resultHref(locale, "projects", "projects", project.slug), title: project.title, label: project.category }));
    teamResults = teamMembers
      .filter((member) => member.name.toLowerCase().includes(needle) || member.role.toLowerCase().includes(needle))
      .map((member) => ({ id: member.entityId, href: resultHref(locale, "team", "team", member.slug), title: member.name, label: member.role }));
  }

  const resultCount = postResults.length + serviceResults.length + productResults.length + projectResults.length + teamResults.length;

  return (
    <>
      <ScrollToTop />
      <SiteHeader locale={locale} dict={dict} />
      <main>
        <PageBanner
          title={dict.searchPage.banner}
          current={dict.searchPage.banner}
          homeLabel={dict.common.home}
          homeHref={staticPath(locale, "home")}
        />
        <section className="py-[120px]">
          <Reveal className="mx-auto max-w-5xl px-[15px]">
            <h2 className="text-center font-display text-[42px] font-bold leading-tight text-ink md:text-[52px]">
              {dict.searchPage.title}
            </h2>
            <form action={staticPath(locale, "search")} method="GET" className="mx-auto mt-10 flex max-w-3xl flex-col gap-3 sm:flex-row">
              <label className="sr-only" htmlFor="site-search">{dict.searchPage.placeholder}</label>
              <input
                id="site-search"
                name="q"
                type="search"
                defaultValue={query}
                placeholder={dict.searchPage.placeholder}
                className="min-w-0 flex-1 border border-hairline bg-base px-5 py-4 text-ink outline-none shadow-card focus:border-brand"
              />
              <button type="submit" className="rounded-pill bg-brand px-8 py-4 font-semibold text-base transition hover:bg-navy">
                {dict.searchPage.submitLabel}
              </button>
            </form>

            {!query ? (
              <p className="mt-12 border-s-2 border-brand bg-brand-soft px-6 py-5 text-center leading-7 text-ink">
                {dict.searchPage.noQuery}
              </p>
            ) : resultCount === 0 ? (
              <p className="mt-12 border-s-2 border-brand bg-brand-soft px-6 py-5 text-center leading-7 text-ink">
                {dict.searchPage.empty}
              </p>
            ) : (
              <div className="mt-14 space-y-12">
                <p className="font-display text-2xl font-semibold text-ink">
                  {dict.searchPage.resultsPrefix} <span className="text-brand">{query}</span>
                </p>
                <ResultSection title={dict.searchPage.categoryPosts} items={postResults} />
                <ResultSection title={dict.searchPage.categoryServices} items={serviceResults} />
                <ResultSection title={dict.searchPage.categoryProducts} items={productResults} />
                <ResultSection title={dict.searchPage.categoryProjects} items={projectResults} />
                <ResultSection title={dict.searchPage.categoryTeam} items={teamResults} />
              </div>
            )}
          </Reveal>
        </section>
      </main>
      <Footer locale={locale} dict={dict} />
    </>
  );
}
