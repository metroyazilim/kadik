import { notFound } from "next/navigation";
import { PageHeader } from "@/components/admin/PageHeader";
import { ADMIN_CONTENT_LOCALE } from "@/lib/i18n/config";
import type { TeamMemberPayload } from "@/lib/content-model/payload-validation";
import { getTeamMemberEditViewAction } from "../actions";
import { TeamEditorPanel } from "../TeamEditorPanel";

type Params = Promise<{ id: string }>;

export default async function TeamMemberEditorPage({ params }: { params: Params }) {
  const { id } = await params;
  const data = await getTeamMemberEditViewAction(id);
  if (!data) notFound();

  const primary = (data.view.translations[ADMIN_CONTENT_LOCALE]?.draftPayload ??
    data.view.translations[ADMIN_CONTENT_LOCALE]?.publishedPayload ??
    null) as TeamMemberPayload | null;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="Kurul"
        title={primary?.name?.trim() || "Yeni kurul üyesi"}
        description="Alanları düzenleyin ve Kaydet deyin; değişiklik hemen sitede yayına girer."
        backHref="/manage/team"
        backLabel="Kurul üyelerine dön"
      />
      <TeamEditorPanel entityId={id} data={data} />
    </div>
  );
}
