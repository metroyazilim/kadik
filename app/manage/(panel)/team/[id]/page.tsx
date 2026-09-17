import { notFound } from "next/navigation";
import { PageHeader } from "@/components/admin/PageHeader";
import { isLocale, type Locale } from "@/lib/i18n/config";
import type { TeamMemberPayload } from "@/lib/content-model/payload-validation";
import { getTeamMemberEditViewAction } from "../actions";
import { TeamEditorPanel } from "../TeamEditorPanel";

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{ locale?: string }>;

export default async function TeamMemberEditorPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const data = await getTeamMemberEditViewAction(id);
  if (!data) notFound();

  const initialLocale: Locale = query.locale && isLocale(query.locale) ? query.locale : "tr";
  const primary = (data.view.translations.tr?.draftPayload ??
    data.view.translations.tr?.publishedPayload ??
    null) as TeamMemberPayload | null;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="Kurul"
        title={primary?.name?.trim() || "Yeni ekip üyesi"}
        description="Dil sekmesini seçin, alanları düzenleyin; Kaydet ve yayınla yalnızca o dili yayına alır."
        backHref="/manage/team"
        backLabel="Ekibe dön"
      />
      <TeamEditorPanel entityId={id} initialLocale={initialLocale} data={data} />
    </div>
  );
}
