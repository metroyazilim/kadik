import { notFound } from "next/navigation";
import { PageHeader } from "@/components/admin/PageHeader";
import { KADIK_PAGE_DEFINITIONS, isKadikContentKey } from "@/lib/kadik-content/pages";
import { getKadikPageForEdit } from "@/lib/kadik-content/store";
import { KadikPageEditor } from "../KadikPageEditor";

export default async function KadikPageEditorRoute({ params }: { params: Promise<{ pageKey: string }> }) {
  const { pageKey } = await params;
  if (!isKadikContentKey(pageKey)) notFound();
  const definition = KADIK_PAGE_DEFINITIONS[pageKey];
  const { data, updatedAt } = await getKadikPageForEdit(pageKey);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        eyebrow="Sayfa düzenleme"
        title={definition.label}
        description={definition.description}
        backHref="/manage/pages"
        backLabel="Sayfalara dön"
      />
      <KadikPageEditor pageKey={pageKey} initialData={data} updatedAt={updatedAt?.toISOString() ?? null} />
    </div>
  );
}
