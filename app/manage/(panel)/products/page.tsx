import { ADMIN_CONTENT_LOCALE } from "@/lib/i18n/config";
import { prisma } from "@/lib/db";
import { CreateRecordButton } from "@/components/admin/CreateRecordButton";
import { PageHeader } from "@/components/admin/PageHeader";
import { Pagination } from "@/components/admin/Pagination";
import { StatCard } from "@/components/admin/StatCard";
import { collectionStats, listCollectionPage } from "@/lib/content-model/collection-admin";
import { PRODUCT_CONTENT_TYPE } from "@/lib/content-model/payload-validation";
import { createProductAction } from "./actions";
import { ProductsListView } from "./ProductsListView";

type SearchParams = Promise<{ page?: string }>;

export default async function ProductsPage({ searchParams }: { searchParams: SearchParams }) {
  const { page } = await searchParams;
  const requestedPage = Number.parseInt(page ?? "1", 10);
  const [list, stats] = await Promise.all([
    listCollectionPage(prisma, PRODUCT_CONTENT_TYPE, { page: requestedPage, displayLocale: ADMIN_CONTENT_LOCALE }),
    collectionStats(prisma, PRODUCT_CONTENT_TYPE, ADMIN_CONTENT_LOCALE),
  ]);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="Ürünler"
        title="Ürün Kataloğu"
        description="Sitede görünen sırayı sürükleyerek değiştirin. Bir kaydı açıp Kaydet dediğinizde değişiklik hemen yayına girer."
        action={<CreateRecordButton action={createProductAction} label="Yeni ürün" />}
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Toplam" value={stats.total} hint="Kayıt" />
        <StatCard label="Yayında" value={stats.publishedTranslations} hint="Sitede görünen" tone="success" />
        <StatCard label="Yayınlanmamış" value={stats.draftTranslations} hint="Yayın bekleyen" tone="warning" />
        <StatCard label="Arşivli" value={stats.archived} hint="Public tarafta yok" />
      </div>

      <ProductsListView rows={list.rows} />
      <Pagination basePath="/manage/products" page={list.page} perPage={list.perPage} total={list.total} />
    </div>
  );
}
