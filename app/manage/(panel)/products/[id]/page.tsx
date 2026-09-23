import { notFound } from "next/navigation";
import { PageHeader } from "@/components/admin/PageHeader";
import { ADMIN_CONTENT_LOCALE } from "@/lib/i18n/config";
import type { ProductPayload } from "@/lib/content-model/payload-validation";
import { getProductEditViewAction } from "../actions";
import { ProductEditorPanel } from "../ProductEditorPanel";

type Params = Promise<{ id: string }>;

/**
 * Full-page editor for one Product entity. The whole edit view (all four
 * locales plus every referenced media preview) is read once here, on the
 * server, so opening the editor is a single request - the client component
 * receives it as props and never re-fetches it.
 */
export default async function ProductEditorPage({ params }: { params: Params }) {
  const { id } = await params;
  const data = await getProductEditViewAction(id);
  if (!data) notFound();

  const primary = (data.view.translations[ADMIN_CONTENT_LOCALE]?.draftPayload ??
    data.view.translations[ADMIN_CONTENT_LOCALE]?.publishedPayload ??
    null) as ProductPayload | null;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="Ürün"
        title={primary?.title?.trim() || "Yeni ürün"}
        description="Alanları düzenleyin ve Kaydet deyin; değişiklik hemen sitede yayına girer."
        backHref="/manage/products"
        backLabel="Ürünlere dön"
      />
      <ProductEditorPanel entityId={id} data={data} />
    </div>
  );
}
