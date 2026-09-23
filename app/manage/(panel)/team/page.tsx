import { ADMIN_CONTENT_LOCALE } from "@/lib/i18n/config";
import { prisma } from "@/lib/db";
import { CreateRecordButton } from "@/components/admin/CreateRecordButton";
import { PageHeader } from "@/components/admin/PageHeader";
import { Pagination } from "@/components/admin/Pagination";
import { StatCard } from "@/components/admin/StatCard";
import { collectionStats, listCollectionPage } from "@/lib/content-model/collection-admin";
import { listThumbnails } from "@/lib/content-model/list-thumbnails";
import { TEAM_MEMBER_CONTENT_TYPE } from "@/lib/content-model/payload-validation";
import { createTeamMemberAction } from "./actions";
import { TeamListView } from "./TeamListView";

type SearchParams = Promise<{ page?: string }>;

export default async function TeamPage({ searchParams }: { searchParams: SearchParams }) {
  const { page } = await searchParams;
  const requestedPage = Number.parseInt(page ?? "1", 10);
  const [list, stats] = await Promise.all([
    listCollectionPage(prisma, TEAM_MEMBER_CONTENT_TYPE, { page: requestedPage, displayLocale: ADMIN_CONTENT_LOCALE }),
    collectionStats(prisma, TEAM_MEMBER_CONTENT_TYPE, ADMIN_CONTENT_LOCALE),
  ]);
  const thumbnails = await listThumbnails(prisma, list.rows, "imageAssetId");

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="Kurul"
        title="Kurul Üyeleri"
        description="Sitede görünen sırayı sürükleyerek değiştirin. Bir kaydı açıp Kaydet dediğinizde değişiklik hemen yayına girer."
        action={<CreateRecordButton action={createTeamMemberAction} label="Yeni kurul üyesi" />}
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Toplam" value={stats.total} hint="Kayıt" />
        <StatCard label="Yayında" value={stats.publishedTranslations} hint="Sitede görünen" tone="success" />
        <StatCard label="Yayınlanmamış" value={stats.draftTranslations} hint="Yayın bekleyen" tone="warning" />
        <StatCard label="Arşivli" value={stats.archived} hint="Public tarafta yok" />
      </div>

      <TeamListView rows={list.rows} thumbnails={thumbnails} />
      <Pagination basePath="/manage/team" page={list.page} perPage={list.perPage} total={list.total} />
    </div>
  );
}
