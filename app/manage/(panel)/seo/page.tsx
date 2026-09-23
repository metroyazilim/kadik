import { PageHeader } from "@/components/admin/PageHeader";
import { prisma } from "@/lib/db";
import { listCollectionPage } from "@/lib/content-model/collection-admin";
import { listThumbnails } from "@/lib/content-model/list-thumbnails";
import { POST_CONTENT_TYPE, type PostPayload } from "@/lib/content-model/payload-validation";
import { ADMIN_CONTENT_LOCALE } from "@/lib/i18n/config";
import { KADIK_PAGE_DEFINITIONS } from "@/lib/kadik-content/pages";
import { ensureKadikPagesSeeded, listKadikSeo } from "@/lib/kadik-content/store";
import { kadikPostPath } from "@/lib/kadik-i18n";
import { SeoWorkspace, type SeoEntry } from "./SeoEditor";

type SearchParams = Promise<{ item?: string }>;

/**
 * One place for every search/social title, description and share image on
 * the site: each KADİK page, then each news article. The screen has its own
 * item sidebar; `?item=page:home` / `?item=post:<id>` selects a row so a
 * link can open a specific entry.
 */
export default async function SeoPage({ searchParams }: { searchParams: SearchParams }) {
  const { item } = await searchParams;
  await ensureKadikPagesSeeded().catch(() => 0);
  const [pages, posts] = await Promise.all([
    listKadikSeo(),
    listCollectionPage(prisma, POST_CONTENT_TYPE, { page: 1, perPage: 100, displayLocale: ADMIN_CONTENT_LOCALE }),
  ]);
  const covers = await listThumbnails(prisma, posts.rows, "coverImageAssetId");

  const pageEntries: SeoEntry[] = pages.map((row) => ({
    kind: "page",
    id: row.key,
    label: KADIK_PAGE_DEFINITIONS[row.key].label,
    path: KADIK_PAGE_DEFINITIONS[row.key].publicPath ?? "/",
    title: row.seo.title,
    description: row.seo.description,
    image: row.seo.image,
    defaultTitle: row.defaults.title,
    defaultDescription: row.defaults.description,
    defaultImage: row.defaults.image,
    editHref: `/manage/pages/${row.key}`,
  }));

  const postEntries: SeoEntry[] = posts.rows
    .filter((row) => !row.archived && row.displayPayload)
    .map((row) => {
      const payload = row.displayPayload as PostPayload;
      return {
        kind: "post",
        id: row.entityId,
        label: payload.title || "(başlıksız haber)",
        path: kadikPostPath("en", payload.slug),
        title: payload.seoTitle ?? "",
        description: payload.seoDescription ?? "",
        image: { url: covers[row.entityId] ?? "", assetId: null },
        defaultTitle: `${payload.title} | KADİK`,
        defaultDescription: payload.excerpt,
        defaultImage: { url: covers[row.entityId] ?? "", assetId: null },
        editHref: `/manage/posts/${row.entityId}`,
      };
    });

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        eyebrow="SEO"
        title="SEO Ayarları"
        description="Soldaki listeden bir sayfa ya da haber seçin. Google başlığı, açıklaması ve sosyal medya paylaşım görseli ayrı ayrı düzenlenir; Kaydet dediğinizde hemen yayına girer."
      />
      <SeoWorkspace pages={pageEntries} posts={postEntries} initialItem={item ?? null} />
    </div>
  );
}
