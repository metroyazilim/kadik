import { notFound } from "next/navigation";
import { PageHeader } from "@/components/admin/PageHeader";
import type { PostPayload } from "@/lib/content-model/payload-validation";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { getPostEditViewAction } from "../actions";
import { PostEditorPanel } from "../PostEditorPanel";

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{ locale?: string }>;

export default async function PostEditorPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const data = await getPostEditViewAction(id);
  if (!data) notFound();

  const initialLocale: Locale = query.locale && isLocale(query.locale) ? query.locale : "tr";
  const primary = (data.view.translations.tr?.draftPayload ??
    data.view.translations.tr?.publishedPayload ??
    null) as PostPayload | null;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="Blog"
        title={primary?.title?.trim() || "Yeni yazı"}
        description="Dil sekmesini seçin, alanları düzenleyin; Kaydet ve yayınla yalnızca o dili yayına alır."
        backHref="/manage/posts"
        backLabel="Yazılara dön"
      />
      <PostEditorPanel entityId={id} initialLocale={initialLocale} data={data} />
    </div>
  );
}
