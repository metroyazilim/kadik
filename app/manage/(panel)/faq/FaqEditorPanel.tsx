"use client";

import { TranslationAssistant } from "@/components/admin/TranslationAssistant";
import { useActionState, useState } from "react";
import type { Locale } from "@/lib/i18n/config";
import type { FaqPayload } from "@/lib/content-model/payload-validation";
import { saveAndPublishFaqAction, saveFaqDraftAction, type FaqEditViewData } from "./actions";
import { EditorPageLayout } from "@/components/admin/EditorPageLayout";
import { EditorPublishPanel } from "@/components/admin/EditorPublishPanel";
import { EditorSection } from "@/components/admin/EditorSection";
import { FieldGrid } from "@/components/admin/FieldGrid";
import { LocaleStatusTabs, STATUS_LABEL, STATUS_TONE } from "@/components/admin/LocaleStatusTabs";
import { fieldInput, fieldLabel } from "@/components/admin/ui";
import { RichTextEditor } from "@/components/admin/RichTextEditor";

/** FAQ editor with collection-edit main column plus contextual publish panel. */
export function FaqEditorPanel({
  entityId,
  initialLocale = "tr",
  data,
}: {
  entityId: string;
  initialLocale?: Locale;
  data: FaqEditViewData;
}) {
  const [activeLocale, setActiveLocale] = useState<Locale>(initialLocale);

  function selectLocale(locale: Locale) {
    setActiveLocale(locale);
    window.history.replaceState(null, "", `/manage/faq/${entityId}?locale=${locale}`);
  }

  return (
    <div className="space-y-4">
      <LocaleStatusTabs
        label="SSS dilleri"
        activeLocale={activeLocale}
        statuses={Object.fromEntries(
          (["tr", "en"] as const).map((locale) => [locale, data.view.translations[locale]?.status ?? "missing"]),
        )}
        onSelect={selectLocale}
        actions={<TranslationAssistant entityId={entityId} />}
      />
      <FaqLocaleForm key={activeLocale} entityId={entityId} locale={activeLocale} editView={data} />
    </div>
  );
}

function FaqLocaleForm({
  entityId,
  locale,
  editView,
}: {
  entityId: string;
  locale: Locale;
  editView: FaqEditViewData;
}) {
  const translation = editView.view.translations[locale];
  const payload = (translation?.draftPayload ?? translation?.publishedPayload ?? null) as FaqPayload | null;
  const status = translation?.status ?? "missing";

  const [draftState, draftAction, isSavingDraft] = useActionState(saveFaqDraftAction, {} as { error?: string; success?: string });
  const [publishState, publishAction, isPublishing] = useActionState(saveAndPublishFaqAction, {} as { error?: string; success?: string });
  const [lastAction, setLastAction] = useState<"draft" | "publish" | null>(null);

  return (
    <form action={draftAction}>
      <input type="hidden" name="entityId" value={entityId} />
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="translationId" value={translation?.translationId ?? ""} />
      <input type="hidden" name="expectedVersion" value={translation?.version ?? 0} />
      <input type="hidden" name="draftRevisionId" value={translation?.draftRevisionId ?? ""} />

      <EditorPageLayout
        main={
          <div className="space-y-4">
            <EditorSection title="Soru" id="faq-question" description="Liste ve arama sonuçlarında görünen soru metni." defaultOpen>
              <FieldGrid>
                <label className={fieldLabel}>
                  Soru
                  <input name="question" defaultValue={payload?.question ?? ""} required className={fieldInput} />
                </label>
              </FieldGrid>
            </EditorSection>
            <EditorSection title="Yanıt" id="faq-answer" description="Public SSS detayında gösterilen zengin metin." defaultOpen>
              <RichTextEditor name="answer" label="Yanıt" defaultValue={payload?.answer ?? ""} maxLength={4000} required />
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
