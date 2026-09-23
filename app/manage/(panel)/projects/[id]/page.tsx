import { notFound } from "next/navigation";
import { PageHeader } from "@/components/admin/PageHeader";
import { ADMIN_CONTENT_LOCALE } from "@/lib/i18n/config";
import type { ProjectPayload } from "@/lib/content-model/payload-validation";
import { getProjectEditViewAction } from "../actions";
import { ProjectEditorPanel } from "../ProjectEditorPanel";

type Params = Promise<{ id: string }>;

/**
 * Full-page editor for one Project entity. The whole edit view (all four
 * locales plus every referenced media preview) is read once here, on the
 * server, so opening the editor is a single request - the client component
 * receives it as props and never re-fetches it.
 */
export default async function ProjectEditorPage({ params }: { params: Params }) {
  const { id } = await params;
  const data = await getProjectEditViewAction(id);
  if (!data) notFound();

  const primary = (data.view.translations[ADMIN_CONTENT_LOCALE]?.draftPayload ??
    data.view.translations[ADMIN_CONTENT_LOCALE]?.publishedPayload ??
    null) as ProjectPayload | null;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="Projeler"
        title={primary?.title?.trim() || "Yeni proje"}
        description="Alanları düzenleyin ve Kaydet deyin; değişiklik hemen sitede yayına girer."
        backHref="/manage/projects"
        backLabel="Projelere dön"
      />
      <ProjectEditorPanel entityId={id} data={data} />
    </div>
  );
}
