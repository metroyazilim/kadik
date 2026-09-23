"use client";

import { SlugPreview } from "@/components/admin/SlugPreview";
import { useActionState, useState } from "react";
import { ADMIN_CONTENT_LOCALE, type Locale } from "@/lib/i18n/config";
import type { ProjectPayload } from "@/lib/content-model/payload-validation";
import { saveProjectDraftAction, saveAndPublishProjectAction, type ProjectEditViewData } from "./actions";
import { ContentBlockEditor } from "@/components/admin/ContentBlockEditor";
import { EditorPageLayout } from "@/components/admin/EditorPageLayout";
import { EditorPublishPanel } from "@/components/admin/EditorPublishPanel";
import { EditorSection } from "@/components/admin/EditorSection";
import { FieldGrid } from "@/components/admin/FieldGrid";
import { STATUS_LABEL, STATUS_TONE } from "@/components/admin/record-status";
import { fieldHint, fieldInput, fieldLabel } from "@/components/admin/ui";
import { MediaField } from "@/components/admin/MediaField";
import { MediaGalleryField } from "@/components/admin/MediaGalleryField";

/** Project editor with collection-edit main column plus contextual publish panel. */
export function ProjectEditorPanel({
  entityId,
  data,
}: {
  entityId: string;
  data: ProjectEditViewData;
}) {
  return <ProjectLocaleForm entityId={entityId} locale={ADMIN_CONTENT_LOCALE} editView={data} />;
}

function ProjectLocaleForm({
  entityId,
  locale,
  editView,
}: {
  entityId: string;
  locale: Locale;
  editView: ProjectEditViewData;
}) {
  const translation = editView.view.translations[locale];
  const payload = (translation?.draftPayload ?? translation?.publishedPayload ?? null) as ProjectPayload | null;
  const status = translation?.status ?? "missing";
  const [draftState, draftAction, isSavingDraft] = useActionState(saveProjectDraftAction, {} as { error?: string; success?: string });
  const [publishState, publishAction, isPublishing] = useActionState(saveAndPublishProjectAction, {} as { error?: string; success?: string });
  const [lastAction, setLastAction] = useState<"draft" | "publish" | null>(null);
  const [coverImage, setCoverImage] = useState<{ url: string; assetId?: string }>({
    url: payload?.coverImageAssetId ? (editView.assetPreviews[payload.coverImageAssetId]?.url ?? "") : "",
    assetId: payload?.coverImageAssetId ?? undefined,
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
      <input type="hidden" name="coverImageAssetId" value={coverImage.assetId ?? ""} />

      <EditorPageLayout
        main={
          <div className="space-y-4">
            <EditorSection title="Temel bilgiler" id="project-basics" description="Listeleme, detay sayfası, kategori ve URL bilgileri." defaultOpen>
              <FieldGrid>
                <label className={fieldLabel}>
                  Başlık
                  <input name="title" className={fieldInput} defaultValue={payload?.title ?? ""} maxLength={150} required />
                </label>
                <SlugPreview sourceName="title" initialValue={payload?.title ?? ""} />
                <label className={fieldLabel}>
                  Kategori
                  <input name="category" className={fieldInput} defaultValue={payload?.category ?? ""} maxLength={120} required />
                </label>
                <label className={fieldLabel}>
                  Müşteri <span className="font-normal text-brand-muted">(isteğe bağlı)</span>
                  <input name="client" className={fieldInput} defaultValue={payload?.client ?? ""} maxLength={150} />
                </label>
              </FieldGrid>
            </EditorSection>

            <EditorSection title="Medya" id="project-media" description="Kapak görseli ve detay galerisi." defaultOpen>
              <FieldGrid>
                <MediaField label="Kapak görseli" contextFieldName="title" contextLabel={payload?.title ?? ""} value={coverImage.url} assetId={coverImage.assetId} onChange={(next) => setCoverImage({ url: next.url, assetId: next.assetId })} activeLocale={locale} />
                <MediaGalleryField name="galleryAssetIds" label="Galeri görselleri" contextLabel={payload?.title ?? "Galeri görselleri"} defaultValue={initialGallery} />
              </FieldGrid>
            </EditorSection>

            <EditorSection title="Meydan okuma" id="project-challenge" description="Proje detayındaki problem/anlam bölümü." defaultOpen>
              <ContentBlockEditor name="challengeBlocks" label="Meydan okuma" defaultValue={payload?.challengeBlocks ?? []} assetPreviews={editView.assetPreviews} />
            </EditorSection>

            <EditorSection title="Çözüm" id="project-solution" description="Proje detayındaki çözüm anlatımı." defaultOpen>
              <ContentBlockEditor name="solutionBlocks" label="Çözüm" defaultValue={payload?.solutionBlocks ?? []} assetPreviews={editView.assetPreviews} />
            </EditorSection>

            <EditorSection title="SEO" id="project-seo" description="Opsiyonel arama motoru başlığı ve açıklaması.">
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
