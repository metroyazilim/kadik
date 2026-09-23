import { notFound } from "next/navigation";
import { PageHeader } from "@/components/admin/PageHeader";
import type { PostPayload } from "@/lib/content-model/payload-validation";
import { ADMIN_CONTENT_LOCALE } from "@/lib/i18n/config";
import { getPostEditViewAction } from "../actions";
import { PostEditorPanel } from "../PostEditorPanel";

type Params = Promise<{ id: string }>;

export default async function PostEditorPage({ params }: { params: Params }) {
  const { id } = await params;
  const data = await getPostEditViewAction(id);
  if (!data) notFound();

  const primary = (data.view.translations[ADMIN_CONTENT_LOCALE]?.draftPayload ??
    data.view.translations[ADMIN_CONTENT_LOCALE]?.publishedPayload ??
    null) as PostPayload | null;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="Haber"
        title={primary?.title?.trim() || "Yeni yazı"}
        description="Alanları düzenleyin ve Kaydet deyin; değişiklik hemen sitede yayına girer."
        backHref="/manage/posts"
        backLabel="Haberlere dön"
      />
      <PostEditorPanel entityId={id} data={data} />
    </div>
  );
}
