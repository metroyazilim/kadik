import { Pagination } from "@/components/admin/Pagination";
import { prisma } from "@/lib/db";
import { listMediaAssets } from "@/lib/media/service";
import { MediaLibraryView } from "./MediaLibraryView";

const MEDIA_PAGE_SIZE = 24;

export async function MediaPanel({ page }: { page: number }) {
  const result = await listMediaAssets(prisma, { page, pageSize: MEDIA_PAGE_SIZE });

  return (
    <>
      <MediaLibraryView key={result.page} initialAssets={result.assets} />
      <Pagination
        basePath="/manage/media"
        page={result.page}
        perPage={result.pageSize}
        total={result.total}
      />
    </>
  );
}
