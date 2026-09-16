import { PageHeader } from "@/components/admin/PageHeader";
import { MediaPanel } from "./MediaPanel";

type SearchParams = Promise<{ page?: string }>;

export default async function MediaManagePage({ searchParams }: { searchParams: SearchParams }) {
  const { page } = await searchParams;
  const parsedPage = Number.parseInt(page ?? "1", 10);
  const requestedPage = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader eyebrow="Medya" title="Medya Kütüphanesi" />
      <MediaPanel page={requestedPage} />
    </div>
  );
}
