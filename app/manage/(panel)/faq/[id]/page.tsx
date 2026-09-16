import { notFound } from "next/navigation";
import { PageHeader } from "@/components/admin/PageHeader";
import { isLocale, type Locale } from "@/lib/i18n/config";
import type { FaqPayload } from "@/lib/content-model/payload-validation";
import { getFaqEditViewAction } from "../actions";
import { FaqEditorPanel } from "../FaqEditorPanel";

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{ locale?: string }>;

/**
 * Full-page editor for one FAQ entity. The edit view is read once on the
 * server and passed to the client editor, which switches among the four
 * already-loaded locales without an additional request.
 */
export default async function FaqEditorPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const data = await getFaqEditViewAction(id);
  if (!data) notFound();

  const initialLocale: Locale = query.locale && isLocale(query.locale) ? query.locale : "tr";
  const primary = (data.view.translations.tr?.draftPayload ??
    data.view.translations.tr?.publishedPayload ??
    null) as FaqPayload | null;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="SSS"
        title={primary?.question?.trim() || "Yeni soru"}
        description="Dil sekmesini seçin, soruyu ve yanıtı düzenleyin; Kaydet ve yayınla yalnızca o dili yayına alır."
        backHref="/manage/faq"
        backLabel="SSS listesine dön"
      />
      <FaqEditorPanel entityId={id} initialLocale={initialLocale} data={data} />
    </div>
  );
}
