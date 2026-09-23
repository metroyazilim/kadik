import { notFound } from "next/navigation";
import { PageHeader } from "@/components/admin/PageHeader";
import { ADMIN_CONTENT_LOCALE } from "@/lib/i18n/config";
import type { FaqPayload } from "@/lib/content-model/payload-validation";
import { getFaqEditViewAction } from "../actions";
import { FaqEditorPanel } from "../FaqEditorPanel";

type Params = Promise<{ id: string }>;

/**
 * Full-page editor for one FAQ entity. The edit view is read once on the
 * server and passed to the client editor, which switches among the four
 * already-loaded locales without an additional request.
 */
export default async function FaqEditorPage({ params }: { params: Params }) {
  const { id } = await params;
  const data = await getFaqEditViewAction(id);
  if (!data) notFound();

  const primary = (data.view.translations[ADMIN_CONTENT_LOCALE]?.draftPayload ??
    data.view.translations[ADMIN_CONTENT_LOCALE]?.publishedPayload ??
    null) as FaqPayload | null;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="SSS"
        title={primary?.question?.trim() || "Yeni soru"}
        description="Alanları düzenleyin ve Kaydet deyin; değişiklik hemen sitede yayına girer."
        backHref="/manage/faq"
        backLabel="SSS listesine dön"
      />
      <FaqEditorPanel entityId={id} data={data} />
    </div>
  );
}
