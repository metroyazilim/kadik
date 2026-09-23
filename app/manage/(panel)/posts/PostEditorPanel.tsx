"use client";

import Link from "next/link";
import { SlugPreview } from "@/components/admin/SlugPreview";
import { useActionState, useState } from "react";
import { ContentBlockEditor } from "@/components/admin/ContentBlockEditor";
import { EditorPageLayout } from "@/components/admin/EditorPageLayout";
import { EditorPublishPanel } from "@/components/admin/EditorPublishPanel";
import { EditorSection } from "@/components/admin/EditorSection";
import { FieldGrid } from "@/components/admin/FieldGrid";
import { STATUS_LABEL, STATUS_TONE } from "@/components/admin/record-status";
import { MediaField } from "@/components/admin/MediaField";
import { fieldHint, fieldInput, fieldLabel, fieldTextarea } from "@/components/admin/ui";
import type { PostPayload } from "@/lib/content-model/payload-validation";
import { ADMIN_CONTENT_LOCALE, type Locale } from "@/lib/i18n/config";
import { saveAndPublishPostAction, savePostDraftAction, type PostEditViewData } from "./actions";

/** Blog post editor with collection-edit main column plus contextual publish panel. */
export function PostEditorPanel({
  entityId,
  data,
}: {
  entityId: string;
  data: PostEditViewData;
}) {
  return <PostLocaleForm entityId={entityId} locale={ADMIN_CONTENT_LOCALE} editView={data} />;
}

function PostLocaleForm({
  entityId,
  locale,
  editView,
}: {
  entityId: string;
  locale: Locale;
  editView: PostEditViewData;
}) {
  const translation = editView.view.translations[locale];
  const payload = (translation?.draftPayload ?? translation?.publishedPayload ?? null) as PostPayload | null;
  const status = translation?.status ?? "missing";

  const [draftState, draftAction, isSavingDraft] = useActionState(savePostDraftAction, {} as { error?: string; success?: string });
  const [publishState, publishAction, isPublishing] = useActionState(saveAndPublishPostAction, {} as { error?: string; success?: string });
  const [lastAction, setLastAction] = useState<"draft" | "publish" | null>(null);
  const [image, setImage] = useState<{ url: string; assetId?: string }>({
    url: payload?.coverImageAssetId ? (editView.assetPreviews[payload.coverImageAssetId]?.url ?? "") : "",
    assetId: payload?.coverImageAssetId ?? undefined,
  });

  return (
    <form action={draftAction}>
      <input type="hidden" name="entityId" value={entityId} />
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="translationId" value={translation?.translationId ?? ""} />
      <input type="hidden" name="expectedVersion" value={translation?.version ?? 0} />
      <input type="hidden" name="draftRevisionId" value={translation?.draftRevisionId ?? ""} />
      <input type="hidden" name="coverImageAssetId" value={image.assetId ?? ""} />

      <EditorPageLayout
        main={
          <div className="space-y-4">
            <EditorSection title="Temel bilgiler" id="post-basics" description="Haber listesi, detay sayfası ve adres bilgileri." defaultOpen>
              <div className="space-y-5">
                <FieldGrid>
                  <label className={fieldLabel}>
                    Başlık
                    <input name="title" className={fieldInput} defaultValue={payload?.title ?? ""} maxLength={150} required />
                  </label>
                  <SlugPreview sourceName="title" initialValue={payload?.title ?? ""} />
                  <label className={fieldLabel}>
                    Kategori
                    <input name="category" className={fieldInput} defaultValue={payload?.category ?? ""} maxLength={80} required />
                  </label>
                  <label className={fieldLabel}>
                    Yazar
                    <input name="author" className={fieldInput} defaultValue={payload?.author ?? "Starter Kurumsal"} maxLength={100} required />
                  </label>
                </FieldGrid>
                <label className={fieldLabel}>
                  Kısa açıklama
                  <textarea name="excerpt" className={fieldTextarea} rows={3} defaultValue={payload?.excerpt ?? ""} maxLength={300} required />
                </label>
              </div>
            </EditorSection>

            <EditorSection title="Yazı içeriği" id="post-content" description="Haber detay sayfasında gösterilen içerik blokları." defaultOpen>
              <ContentBlockEditor name="blocks" label="Yazı içeriği" defaultValue={payload?.blocks ?? []} assetPreviews={editView.assetPreviews} />
            </EditorSection>

            <EditorSection title="Medya" id="post-media" description="Haber kapak görseli.">
              <MediaField label="Kapak görseli" contextFieldName="title" contextLabel={payload?.title ?? ""} value={image.url} assetId={image.assetId} onChange={(next) => setImage({ url: next.url, assetId: next.assetId })} />
            </EditorSection>

            {/* SEO is edited on the SEO screen; the current values ride along unchanged. */}
            <input type="hidden" name="seoTitle" value={payload?.seoTitle ?? ""} />
            <input type="hidden" name="seoDescription" value={payload?.seoDescription ?? ""} />
            <p className="px-1 text-xs text-brand-muted">
              Bu haberin Google başlığı ve açıklaması{" "}
              <Link href={`/manage/seo?item=post:${entityId}`} className="font-semibold text-brand-primary hover:underline">
                SEO ekranından
              </Link>{" "}
              düzenlenir.
            </p>
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
            extra={status === "published" ? <span className="text-xs text-brand-muted">Yayın tarihi otomatik olarak yayınlama anında ayarlanır.</span> : null}
          />
        }
      />
    </form>
  );
}
