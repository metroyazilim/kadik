"use client";

import { SlugPreview } from "@/components/admin/SlugPreview";
import { useActionState, useState } from "react";
import { ADMIN_CONTENT_LOCALE, type Locale } from "@/lib/i18n/config";
import type { ProductPayload } from "@/lib/content-model/payload-validation";
import { saveProductDraftAction, saveAndPublishProductAction, type ProductEditViewData } from "./actions";
import { ContentBlockEditor } from "@/components/admin/ContentBlockEditor";
import { EditorPageLayout } from "@/components/admin/EditorPageLayout";
import { EditorPublishPanel } from "@/components/admin/EditorPublishPanel";
import { EditorSection } from "@/components/admin/EditorSection";
import { FieldGrid } from "@/components/admin/FieldGrid";
import { STATUS_LABEL, STATUS_TONE } from "@/components/admin/record-status";
import { fieldHint, fieldInput, fieldLabel } from "@/components/admin/ui";
import { MediaField } from "@/components/admin/MediaField";
import { MediaGalleryField } from "@/components/admin/MediaGalleryField";

/** Product editor with collection-edit main column plus contextual publish panel. */
export function ProductEditorPanel({
  entityId,
  data,
}: {
  entityId: string;
  data: ProductEditViewData;
}) {
  return <ProductLocaleForm entityId={entityId} locale={ADMIN_CONTENT_LOCALE} editView={data} />;
}

function ProductLocaleForm({
  entityId,
  locale,
  editView,
}: {
  entityId: string;
  locale: Locale;
  editView: ProductEditViewData;
}) {
  const translation = editView.view.translations[locale];
  const payload = (translation?.draftPayload ?? translation?.publishedPayload ?? null) as ProductPayload | null;
  const status = translation?.status ?? "missing";
  const [draftState, draftAction, isSavingDraft] = useActionState(saveProductDraftAction, {} as { error?: string; success?: string });
  const [publishState, publishAction, isPublishing] = useActionState(saveAndPublishProductAction, {} as { error?: string; success?: string });
  const [lastAction, setLastAction] = useState<"draft" | "publish" | null>(null);
  const [image, setImage] = useState<{ url: string; assetId?: string }>({
    url: payload?.imageAssetId ? (editView.assetPreviews[payload.imageAssetId]?.url ?? "") : "",
    assetId: payload?.imageAssetId ?? undefined,
  });
  const initialGallery = (payload?.galleryAssetIds ?? []).flatMap((assetId) => {
    const preview = editView.assetPreviews[assetId];
    return preview ? [{ assetId, url: preview.url }] : [];
  });

  return (
    <form action={draftAction}>
      <input type="hidden" name="entityId" value={entityId} />
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="translationId" value={translation?.translationId ?? ""} />
      <input type="hidden" name="expectedVersion" value={translation?.version ?? 0} />
      <input type="hidden" name="draftRevisionId" value={translation?.draftRevisionId ?? ""} />
      <input type="hidden" name="imageAssetId" value={image.assetId ?? ""} />

      <EditorPageLayout
        main={
          <div className="space-y-4">
            <EditorSection title="Temel bilgiler" id="product-basics" description="Listeleme, detay sayfası, fiyat etiketi ve URL bilgileri." defaultOpen>
              <div className="space-y-5">
                <FieldGrid>
                  <label className={fieldLabel}>
                    Başlık
                    <input name="title" className={fieldInput} defaultValue={payload?.title ?? ""} maxLength={150} required />
                  </label>
                  <SlugPreview sourceName="title" initialValue={payload?.title ?? ""} />
                  <label className={fieldLabel}>
                    Rozet <span className="font-normal text-brand-muted">(isteğe bağlı)</span>
                    <input name="badge" className={fieldInput} defaultValue={payload?.badge ?? ""} maxLength={80} />
                  </label>
                  <label className={fieldLabel}>
                    Fiyat etiketi <span className="font-normal text-brand-muted">(isteğe bağlı)</span>
                    <input name="priceLabel" className={fieldInput} defaultValue={payload?.priceLabel ?? ""} maxLength={120} />
                  </label>
                  <label className={fieldLabel}>
                    Satın alma / teklif URL&apos;si <span className="font-normal text-brand-muted">(isteğe bağlı)</span>
                    <input name="ctaUrl" className={fieldInput} defaultValue={payload?.ctaUrl ?? ""} maxLength={500} />
                  </label>
                </FieldGrid>
                <label className={fieldLabel}>
                  Kısa açıklama
                  <textarea name="summary" className={`${fieldInput} resize-y`} rows={2} defaultValue={payload?.summary ?? ""} maxLength={300} required />
                </label>
              </div>
            </EditorSection>

            <EditorSection title="Ürün içeriği" id="product-content" description="Detay sayfasındaki zengin içerik blokları." defaultOpen>
              <ContentBlockEditor name="blocks" label="Ürün içeriği" defaultValue={payload?.blocks ?? []} assetPreviews={editView.assetPreviews} />
            </EditorSection>

            <EditorSection title="Medya" id="product-media" description="Ürün görseli ve detay galerisi.">
              <FieldGrid>
                <MediaField label="Ürün görseli" contextFieldName="title" contextLabel={payload?.title ?? ""} value={image.url} assetId={image.assetId} onChange={(next) => setImage({ url: next.url, assetId: next.assetId })} activeLocale={locale} />
                <MediaGalleryField name="galleryAssetIds" label="Galeri görselleri" contextLabel={payload?.title ?? "Galeri görselleri"} defaultValue={initialGallery} />
              </FieldGrid>
            </EditorSection>

            <EditorSection title="SEO" id="product-seo" description="Opsiyonel arama motoru başlığı ve açıklaması.">
              <FieldGrid>
                <label className={fieldLabel}>
                  SEO başlığı (opsiyonel)
                  <input name="seoTitle" className={fieldInput} defaultValue={payload?.seoTitle ?? ""} maxLength={70} />
                </label>
                <label className={fieldLabel}>
                  SEO açıklaması (opsiyonel)
                  <textarea name="seoDescription" className={`${fieldInput} resize-y`} rows={2} defaultValue={payload?.seoDescription ?? ""} maxLength={160} />
                </label>
              </FieldGrid>
            </EditorSection>
          </div>
        }
        aside={
          <EditorPublishPanel
            statusLabel={STATUS_LABEL[status]}
            statusTone={STATUS_TONE[status]}
            version={translation?.version}
            hint="Kaydet dediğinizde değişiklik hemen sitede yayına girer."
            isSavingDraft={isSavingDraft}
            isPublishing={isPublishing}
            canPublish
            onDraftClick={() => setLastAction("draft")}
            onPublishClick={() => setLastAction("publish")}
            publishFormAction={publishAction}
            error={lastAction === "publish" ? (publishState.error ?? draftState.error) : (draftState.error ?? publishState.error)}
            success={lastAction === "publish" ? (publishState.success ?? draftState.success) : (draftState.success ?? publishState.success)}
          />
        }
      />
    </form>
  );
}
