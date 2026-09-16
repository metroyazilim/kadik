"use client";

import { TranslationAssistant } from "@/components/admin/TranslationAssistant";
import { SlugPreview } from "@/components/admin/SlugPreview";
import { useActionState, useState } from "react";
import type { Locale } from "@/lib/i18n/config";
import type { TeamMemberPayload } from "@/lib/content-model/payload-validation";
import { saveAndPublishTeamMemberAction, saveTeamMemberDraftAction, type TeamMemberEditViewData } from "./actions";
import { EditorPageLayout } from "@/components/admin/EditorPageLayout";
import { EditorPublishPanel } from "@/components/admin/EditorPublishPanel";
import { EditorSection } from "@/components/admin/EditorSection";
import { FieldGrid } from "@/components/admin/FieldGrid";
import { LocaleStatusTabs, STATUS_LABEL, STATUS_TONE } from "@/components/admin/LocaleStatusTabs";
import { fieldHint, fieldInput, fieldLabel, fieldTextarea } from "@/components/admin/ui";
import { MediaField } from "@/components/admin/MediaField";
import { RichTextEditor } from "@/components/admin/RichTextEditor";

/** Team member editor with collection-edit main column plus contextual publish panel. */
export function TeamEditorPanel({
  entityId,
  initialLocale = "tr",
  data,
}: {
  entityId: string;
  initialLocale?: Locale;
  data: TeamMemberEditViewData;
}) {
  const [activeLocale, setActiveLocale] = useState<Locale>(initialLocale);

  function selectLocale(locale: Locale) {
    setActiveLocale(locale);
    window.history.replaceState(null, "", `/manage/team/${entityId}?locale=${locale}`);
  }

  return (
    <div className="space-y-4">
      <LocaleStatusTabs
        label="Ekip üyesi dilleri"
        activeLocale={activeLocale}
        statuses={Object.fromEntries(
          (["tr", "en"] as const).map((locale) => [locale, data.view.translations[locale]?.status ?? "missing"]),
        )}
        onSelect={selectLocale}
        actions={<TranslationAssistant entityId={entityId} />}
      />
      <TeamMemberLocaleForm key={activeLocale} entityId={entityId} locale={activeLocale} editView={data} />
    </div>
  );
}

function TeamMemberLocaleForm({
  entityId,
  locale,
  editView,
}: {
  entityId: string;
  locale: Locale;
  editView: TeamMemberEditViewData;
}) {
  const translation = editView.view.translations[locale];
  const payload = (translation?.draftPayload ?? translation?.publishedPayload ?? null) as TeamMemberPayload | null;
  const status = translation?.status ?? "missing";

  const [draftState, draftAction, isSavingDraft] = useActionState(saveTeamMemberDraftAction, {} as { error?: string; success?: string });
  const [publishState, publishAction, isPublishing] = useActionState(saveAndPublishTeamMemberAction, {} as { error?: string; success?: string });
  const [lastAction, setLastAction] = useState<"draft" | "publish" | null>(null);
  const [image, setImage] = useState<{ url: string; assetId?: string }>({
    url: payload?.imageAssetId ? (editView.assetPreviews[payload.imageAssetId]?.url ?? "") : "",
    assetId: payload?.imageAssetId ?? undefined,
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
            <EditorSection title="Profil" id="team-profile" description="Public ekip detayında ve liste kartında görünen temel bilgiler." defaultOpen>
              <div className="space-y-5">
                <FieldGrid>
                  <label className={fieldLabel}>
                    Ad soyad
                    <input name="name" defaultValue={payload?.name ?? ""} required className={fieldInput} />
                  </label>
                  <SlugPreview sourceName="name" initialValue={payload?.name ?? ""} />
                  <label className={fieldLabel}>
                    Görev / unvan
                    <input name="role" defaultValue={payload?.role ?? ""} required className={fieldInput} />
                  </label>
                  <label className={fieldLabel}>
                    E-posta
                    <input name="email" type="email" defaultValue={payload?.email ?? ""} className={fieldInput} />
                  </label>
                  <label className={fieldLabel}>
                    Telefon
                    <input name="phone" type="tel" defaultValue={payload?.phone ?? ""} className={fieldInput} />
                  </label>
                </FieldGrid>
                <MediaField contextFieldName="name" contextLabel={payload?.name ?? ""} value={image.url} assetId={image.assetId} onChange={(next) => setImage({ url: next.url, assetId: next.assetId })} label="Görsel" activeLocale={locale} />
              </div>
            </EditorSection>

            <EditorSection title="Biyografi" id="team-bio" description="Ekip üyesi detay sayfasındaki ana metin." defaultOpen>
              <RichTextEditor name="bio" label="Biyografi" defaultValue={payload?.bio ?? ""} maxLength={4000} required />
            </EditorSection>

            <EditorSection title="Sosyal bağlantılar" id="team-social" description="Profil kartlarında gösterilen opsiyonel sosyal URL'ler.">
              <FieldGrid>
                <label className={fieldLabel}>
                  Instagram URL
                  <input name="instagram" type="url" defaultValue={payload?.social?.instagram ?? ""} className={fieldInput} />
                </label>
                <label className={fieldLabel}>
                  LinkedIn URL
                  <input name="linkedin" type="url" defaultValue={payload?.social?.linkedin ?? ""} className={fieldInput} />
                </label>
              </FieldGrid>
            </EditorSection>

            <EditorSection title="SEO" id="team-seo" description="Opsiyonel arama motoru başlığı ve açıklaması.">
              <FieldGrid>
                <label className={fieldLabel}>
                  SEO başlığı
                  <input name="seoTitle" defaultValue={payload?.seoTitle ?? ""} className={fieldInput} />
                </label>
                <label className={fieldLabel}>
                  SEO açıklaması
                  <textarea name="seoDescription" defaultValue={payload?.seoDescription ?? ""} rows={2} maxLength={300} className={`${fieldInput} resize-y`} />
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
          />
        }
      />
    </form>
  );
}
