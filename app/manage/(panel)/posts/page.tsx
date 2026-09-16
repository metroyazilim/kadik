import { CreateRecordButton } from "@/components/admin/CreateRecordButton";
import { PageHeader } from "@/components/admin/PageHeader";
import { Pagination } from "@/components/admin/Pagination";
import { StatCard } from "@/components/admin/StatCard";
import { collectionStats, listCollectionPage } from "@/lib/content-model/collection-admin";
import { prisma } from "@/lib/db";
import { POST_CONTENT_TYPE } from "@/lib/content-model/payload-validation";
import { createPostAction } from "./actions";
import { PostsListView } from "./PostsListView";

type SearchParams = Promise<{ page?: string }>;

export default async function PostsPage({ searchParams }: { searchParams: SearchParams }) {
  const { page } = await searchParams;
  const requestedPage = Number.parseInt(page ?? "1", 10);
  const [list, stats] = await Promise.all([
    listCollectionPage(prisma, POST_CONTENT_TYPE, { page: requestedPage }),
    collectionStats(prisma, POST_CONTENT_TYPE),
  ]);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="Blog"
        title="Blog Yazıları"
        description="Her yazı Türkçe ve Global dilinde bağımsız kayıt/yayın durumuna sahiptir. Yönetim sırasını sürükleyerek değiştirin."
        action={<CreateRecordButton action={createPostAction} label="Yeni yazı" />}
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Toplam" value={stats.total} hint="Kayıt" />
        <StatCard label="Yayında" value={stats.publishedTranslations} hint="Dil bazında" tone="success" />
        <StatCard label="Yayınlanmamış" value={stats.draftTranslations} hint="Yayın bekleyen" tone="warning" />
        <StatCard label="Arşivli" value={stats.archived} hint="Public tarafta yok" />
      </div>

      <PostsListView rows={list.rows} />
      <Pagination basePath="/manage/posts" page={list.page} perPage={list.perPage} total={list.total} />
    </div>
  );
}
