import { prisma } from "@/lib/db";
import { CreateRecordButton } from "@/components/admin/CreateRecordButton";
import { PageHeader } from "@/components/admin/PageHeader";
import { Pagination } from "@/components/admin/Pagination";
import { StatCard } from "@/components/admin/StatCard";
import { collectionStats, listCollectionPage } from "@/lib/content-model/collection-admin";
import { FAQ_CONTENT_TYPE } from "@/lib/content-model/payload-validation";
import { createFaqAction } from "./actions";
import { FaqListView } from "./FaqListView";

type SearchParams = Promise<{ page?: string }>;

export default async function FaqPage({ searchParams }: { searchParams: SearchParams }) {
  const { page } = await searchParams;
  const requestedPage = Number.parseInt(page ?? "1", 10);
  const [list, stats] = await Promise.all([
    listCollectionPage(prisma, FAQ_CONTENT_TYPE, { page: requestedPage }),
    collectionStats(prisma, FAQ_CONTENT_TYPE),
  ]);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="SSS"
        title="Sıkça Sorulan Sorular"
        description="Her soru Türkçe ve Global dilinde bağımsız kayıt/yayın durumuna sahiptir. Sırayı sürükleyerek değiştirin."
        action={<CreateRecordButton action={createFaqAction} label="Yeni soru" />}
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Toplam" value={stats.total} hint="Kayıt" />
        <StatCard label="Yayında" value={stats.publishedTranslations} hint="Dil bazında" tone="success" />
        <StatCard label="Yayınlanmamış" value={stats.draftTranslations} hint="Yayın bekleyen" tone="warning" />
        <StatCard label="Arşivli" value={stats.archived} hint="Public tarafta yok" />
      </div>

      <FaqListView rows={list.rows} />
      <Pagination basePath="/manage/faq" page={list.page} perPage={list.perPage} total={list.total} />
    </div>
  );
}
