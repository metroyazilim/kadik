import { notFound } from "next/navigation";
import { PageHeader } from "@/components/admin/PageHeader";
import { isLocale, type Locale } from "@/lib/i18n/config";
import type { ProjectPayload } from "@/lib/content-model/payload-validation";
import { getProjectEditViewAction } from "../actions";
import { ProjectEditorPanel } from "../ProjectEditorPanel";

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{ locale?: string }>;

/**
 * Full-page editor for one Project entity. The whole edit view (all four
 * locales plus every referenced media preview) is read once here, on the
 * server, so opening the editor is a single request - the client component
 * receives it as props and never re-fetches it.
 */
export default async function ProjectEditorPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const data = await getProjectEditViewAction(id);
  if (!data) notFound();

  const initialLocale: Locale = query.locale && isLocale(query.locale) ? query.locale : "tr";
  const primary = (data.view.translations.tr?.draftPayload ??
    data.view.translations.tr?.publishedPayload ??
    null) as ProjectPayload | null;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="Projeler"
        title={primary?.title?.trim() || "Yeni proje"}
        description="Dil sekmesini seçin, alanları düzenleyin; Kaydet ve yayınla yalnızca o dili yayına alır."
        backHref="/manage/projects"
        backLabel="Projelere dön"
      />
      <ProjectEditorPanel entityId={id} initialLocale={initialLocale} data={data} />
    </div>
  );
}
