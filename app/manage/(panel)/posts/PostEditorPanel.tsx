"use client";

import { TranslationAssistant } from "@/components/admin/TranslationAssistant";
import { SlugPreview } from "@/components/admin/SlugPreview";
import { useActionState, useState } from "react";
import { ContentBlockEditor } from "@/components/admin/ContentBlockEditor";
import { EditorPageLayout } from "@/components/admin/EditorPageLayout";
import { EditorPublishPanel } from "@/components/admin/EditorPublishPanel";
import { EditorSection } from "@/components/admin/EditorSection";
import { FieldGrid } from "@/components/admin/FieldGrid";
import { LocaleStatusTabs, STATUS_LABEL, STATUS_TONE } from "@/components/admin/LocaleStatusTabs";
import { MediaField } from "@/components/admin/MediaField";
import { fieldHint, fieldInput, fieldLabel, fieldTextarea } from "@/components/admin/ui";
import type { PostPayload } from "@/lib/content-model/payload-validation";
import type { Locale } from "@/lib/i18n/config";
import { saveAndPublishPostAction, savePostDraftAction, type PostEditViewData } from "./actions";

/** Blog post editor with collection-edit main column plus contextual publish panel. */
export function PostEditorPanel({
  entityId,
  initialLocale = "tr",
  data,
}: {
  entityId: string;
  initialLocale?: Locale;
  data: PostEditViewData;
}) {
  const [activeLocale, setActiveLocale] = useState<Locale>(initialLocale);

  function selectLocale(locale: Locale) {
    setActiveLocale(locale);
    window.history.replaceState(null, "", `/manage/posts/${entityId}?locale=${locale}`);
  }

  return (
    <div className="space-y-4">
      <LocaleStatusTabs
        label="Blog yazısı dilleri"
        activeLocale={activeLocale}
        statuses={Object.fromEntries(
          (["tr", "en"] as const).map((locale) => [locale, data.view.translations[locale]?.status ?? "missing"]),
        )}
        onSelect={selectLocale}
        actions={<TranslationAssistant entityId={entityId} />}
      />
      <PostLocaleForm key={activeLocale} entityId={entityId} locale={activeLocale} editView={data} />
    </div>
  );
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
            <EditorSection title="Temel bilgiler" id="post-basics" description="Blog listeleme, detay sayfası ve URL bilgileri." defaultOpen>
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

            <EditorSection title="Yazı içeriği" id="post-content" description="Blog detayında gösterilen zengin içerik blokları." defaultOpen>
              <ContentBlockEditor name="blocks" label="Yazı içeriği" defaultValue={payload?.blocks ?? []} assetPreviews={editView.assetPreviews} />
            </EditorSection>

            <EditorSection title="Medya" id="post-media" description="Blog kapak görseli.">
              <MediaField label="Kapak görseli" contextFieldName="title" contextLabel={payload?.title ?? ""} value={image.url} assetId={image.assetId} onChange={(next) => setImage({ url: next.url, assetId: next.assetId })} />
            </EditorSection>

            <EditorSection title="SEO" id="post-seo" description="Opsiyonel arama motoru başlığı ve açıklaması.">
              <FieldGrid>
                <label className={fieldLabel}>
                  SEO başlığı (opsiyonel)
                  <input name="seoTitle" className={fieldInput} defaultValue={payload?.seoTitle ?? ""} maxLength={70} />
                </label>
                <label className={fieldLabel}>
                  SEO açıklaması (opsiyonel)
                  <input name="seoDescription" className={fieldInput} defaultValue={payload?.seoDescription ?? ""} maxLength={160} />
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
            hint="Kaydet ve yayınla bu dili tek adımda yayına alır. Kaydet ise yayınlamadan saklar."
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
