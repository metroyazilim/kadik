"use client";

import { TranslationAssistant } from "@/components/admin/TranslationAssistant";
import { useActionState, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { Locale } from "@/lib/i18n/config";
import type { AboutFeaturePayload, AboutPagePayload } from "@/lib/content-model/about-page-schema";
import { saveAboutDraftAction, saveAndPublishAboutAction, type AboutEditViewData } from "./actions";
import { EditorPageLayout } from "@/components/admin/EditorPageLayout";
import { EditorPublishPanel } from "@/components/admin/EditorPublishPanel";
import { EditorSection } from "@/components/admin/EditorSection";
import { FieldGrid } from "@/components/admin/FieldGrid";
import { LazyEditorBoundary } from "@/components/admin/LazyEditorBoundary";
import { LocaleStatusTabs, STATUS_LABEL, STATUS_TONE } from "@/components/admin/LocaleStatusTabs";
import { fieldHint, fieldInput, fieldLabel, secondaryButton } from "@/components/admin/ui";
import { MediaField } from "@/components/admin/MediaField";
import { RichTextEditor } from "@/components/admin/RichTextEditor";
import { SortableList, SortableDragHandleIcon } from "@/components/admin/SortableList";

const MAX_MARQUEE_WORDS = 8;

type AboutEditorPanelProps = Readonly<{
  initialLocale?: Locale;
  data: AboutEditViewData;
}>;

/** About page content editor. Locale tabs are local state; the server page
 * hydrates all four locales once and each save/publish revalidates this route. */
export function AboutEditorPanel({ initialLocale = "tr", data }: AboutEditorPanelProps) {
  const [activeLocale, setActiveLocale] = useState<Locale>(initialLocale);

  function selectLocale(locale: Locale) {
    setActiveLocale(locale);
    window.history.replaceState(null, "", `/manage/pages/about?locale=${locale}`);
  }

  return (
    <div className="space-y-4">
      <LocaleStatusTabs
        label="About sayfası dilleri"
        activeLocale={activeLocale}
        statuses={Object.fromEntries(
          (["tr", "en"] as const).map((locale) => [locale, data.view.translations[locale]?.status ?? "missing"]),
        )}
        onSelect={selectLocale}
        actions={<TranslationAssistant entityId={data.entityId} />}
      />
      <AboutLocaleForm key={activeLocale} entityId={data.entityId} locale={activeLocale} editView={data} />
    </div>
  );
}

type FeatureRow = AboutFeaturePayload & { id: string };
type WordRow = { id: string; value: string };

/** Row ids are index-derived, not `crypto.randomUUID()`: these rows are built
 * during render on both server and client, and a random id would differ
 * between the two passes and trip a hydration mismatch. */
function toFeatureRows(features: AboutPagePayload["features"] | undefined): FeatureRow[] {
  const source =
    features && features.length === 2
      ? features
      : [
          { title: "", text: "" },
          { title: "", text: "" },
        ];
  return source.map((feature, index) => ({ ...feature, id: `feature-${index}` }));
}

function toWordRows(words: readonly string[] | undefined, minCount: number): WordRow[] {
  const source = words && words.length >= minCount ? words : Array.from({ length: minCount }, () => "");
  return source.map((value, index) => ({ id: `word-${index}`, value }));
}

function AboutLocaleForm({
  entityId,
  locale,
  editView,
}: {
  entityId: string;
  locale: Locale;
  editView: AboutEditViewData;
}) {
  const translation = editView.view.translations[locale];
  const payload = (translation?.draftPayload ?? translation?.publishedPayload ?? null) as AboutPagePayload | null;
  const status = translation?.status ?? "missing";

  const [draftState, draftAction, isSavingDraft] = useActionState(saveAboutDraftAction, {} as { error?: string; success?: string });
  const [publishState, publishAction, isPublishing] = useActionState(saveAndPublishAboutAction, {} as { error?: string; success?: string });
  const [lastAction, setLastAction] = useState<"draft" | "publish" | null>(null);

  const [collageImage, setCollageImage] = useState<{ url: string; assetId?: string }>({
    url: payload?.collageImageAssetId ? (editView.assetPreviews[payload.collageImageAssetId]?.url ?? "") : "",
    assetId: payload?.collageImageAssetId ?? undefined,
  });
  const [authorImage, setAuthorImage] = useState<{ url: string; assetId?: string }>({
    url: payload?.authorImageAssetId ? (editView.assetPreviews[payload.authorImageAssetId]?.url ?? "") : "",
    assetId: payload?.authorImageAssetId ?? undefined,
  });

  const [features, setFeatures] = useState<FeatureRow[]>(() => toFeatureRows(payload?.features));
  const [offeringLabels, setOfferingLabels] = useState<WordRow[]>(() => toWordRows(payload?.offeringLabels, 5));
  const [marquee, setMarquee] = useState<WordRow[]>(() => toWordRows(payload?.marquee, 1));

  function reorderFeatures(nextOrderedIds: readonly string[]) {
    setFeatures((current) => nextOrderedIds.map((id) => current.find((row) => row.id === id)!));
  }
  function reorderOfferingLabels(nextOrderedIds: readonly string[]) {
    setOfferingLabels((current) => nextOrderedIds.map((id) => current.find((row) => row.id === id)!));
  }
  function reorderMarquee(nextOrderedIds: readonly string[]) {
    setMarquee((current) => nextOrderedIds.map((id) => current.find((row) => row.id === id)!));
  }

  return (
    <form action={draftAction}>
      <input type="hidden" name="entityId" value={entityId} />
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="translationId" value={translation?.translationId ?? ""} />
      <input type="hidden" name="expectedVersion" value={translation?.version ?? 0} />
      <input type="hidden" name="draftRevisionId" value={translation?.draftRevisionId ?? ""} />
      <input type="hidden" name="collageImageAssetId" value={collageImage.assetId ?? ""} />
      <input type="hidden" name="authorImageAssetId" value={authorImage.assetId ?? ""} />
      <input type="hidden" name="features" value={JSON.stringify(features.map(({ title, text }) => ({ title, text })))} />
      <input type="hidden" name="offeringLabels" value={JSON.stringify(offeringLabels.map((row) => row.value))} />
      <input type="hidden" name="marquee" value={JSON.stringify(marquee.map((row) => row.value))} />

      <EditorPageLayout
        main={
          <div className="space-y-4">
            <EditorSection title="Hero Section" id="about-hero" description="About sayfasının üst bölümü, deneyim kartı ve kolaj görseli." defaultOpen>
              <div className="space-y-5">
                <FieldGrid columns={3}>
                  <label className={fieldLabel}>
                    Üst başlık (banner)
                    <input name="banner" className={fieldInput} defaultValue={payload?.banner ?? ""} maxLength={150} required />
                  </label>
                  <label className={fieldLabel}>
                    Küçük başlık (subtitle)
                    <input name="subtitle" className={fieldInput} defaultValue={payload?.subtitle ?? ""} maxLength={150} required />
                  </label>
                </FieldGrid>
                <FieldGrid columns={3}>
                  <label className={fieldLabel}>
                    Başlık - önce
                    <input name="titleBefore" className={fieldInput} defaultValue={payload?.titleBefore ?? ""} maxLength={100} required />
                  </label>
                  <label className={fieldLabel}>
                    Başlık - vurgulu
                    <input name="titleAccent" className={fieldInput} defaultValue={payload?.titleAccent ?? ""} maxLength={100} required />
                    <span className={fieldHint}>Marka renginde gösterilir.</span>
                  </label>
                  <label className={fieldLabel}>
                    Başlık - sonra
                    <input name="titleAfter" className={fieldInput} defaultValue={payload?.titleAfter ?? ""} maxLength={100} required />
                  </label>
                </FieldGrid>
                <LazyEditorBoundary fallback="Açıklama metni düzenleyicisi yükleniyor…">
                  <RichTextEditor name="text" label="Açıklama metni" defaultValue={payload?.text ?? ""} maxLength={2000} required />
                </LazyEditorBoundary>
                <FieldGrid>
                  <MediaField label="Kolaj görseli" value={collageImage.url} assetId={collageImage.assetId} onChange={(next) => setCollageImage({ url: next.url, assetId: next.assetId })} />
                  <label className={fieldLabel}>
                    Kolaj görseli alt metni
                    <input name="collageAlt" className={fieldInput} defaultValue={payload?.collageAlt ?? ""} maxLength={150} required />
                  </label>
                </FieldGrid>
                <FieldGrid columns={3}>
                  <label className={fieldLabel}>
                    Deneyim değeri
                    <input name="experienceValue" className={fieldInput} defaultValue={payload?.experienceValue ?? ""} maxLength={20} required />
                  </label>
                  <label className={fieldLabel}>
                    Deneyim birimi
                    <input name="experienceUnit" className={fieldInput} defaultValue={payload?.experienceUnit ?? ""} maxLength={40} required />
                  </label>
                  <label className={fieldLabel}>
                    Deneyim etiketi
                    <input name="experienceLabel" className={fieldInput} defaultValue={payload?.experienceLabel ?? ""} maxLength={80} required />
                  </label>
                </FieldGrid>
              </div>
            </EditorSection>

            <EditorSection title="Öne çıkan özellikler" id="about-features" description="İki özellik korunur; yalnızca sıra ve metin düzenlenir.">
              <SortableList
                items={features}
                onReorder={reorderFeatures}
                renderItem={(row, { setNodeRef, style, dragHandleProps, isDragging }) => (
                  <div ref={setNodeRef} style={style} className={`flex items-start gap-3 rounded-[var(--radius-md)] border border-brand-border bg-brand-surface p-4 ${isDragging ? "opacity-60" : ""}`}>
                    <button type="button" {...dragHandleProps} aria-label={`${row.title || "Özellik"} sırasını değiştir`} className="mt-2 text-brand-muted hover:text-brand-text">
                      <SortableDragHandleIcon />
                    </button>
                    <FieldGrid className="flex-1">
                      <label className={fieldLabel}>
                        Başlık
                        <input className={fieldInput} value={row.title} maxLength={80} required onChange={(event) => setFeatures((current) => current.map((r) => (r.id === row.id ? { ...r, title: event.target.value } : r)))} />
                      </label>
                      <label className={fieldLabel}>
                        Metin
                        <input className={fieldInput} value={row.text} maxLength={200} required onChange={(event) => setFeatures((current) => current.map((r) => (r.id === row.id ? { ...r, text: event.target.value } : r)))} />
                      </label>
                    </FieldGrid>
                  </div>
                )}
              />
            </EditorSection>

            <EditorSection title="Sunduklarımız" id="about-offerings" description="Başlık ve sabit beş etiket; her etiket public ikon eşleşmesini korur.">
              <div className="space-y-4">
                <FieldGrid>
                  <label className={fieldLabel}>
                    Küçük başlık
                    <input name="offeringSubtitle" className={fieldInput} defaultValue={payload?.offeringSubtitle ?? ""} maxLength={150} required />
                  </label>
                  <label className={fieldLabel}>
                    Başlık
                    <input name="offeringTitle" className={fieldInput} defaultValue={payload?.offeringTitle ?? ""} maxLength={150} required />
                  </label>
                </FieldGrid>
                <p className={fieldHint}>Tam beş etiket - sırala, ekleme/çıkarma yok (her biri sabit bir ikonla eşleşir).</p>
                <SortableList
                  items={offeringLabels}
                  onReorder={reorderOfferingLabels}
                  renderItem={(row, { setNodeRef, style, dragHandleProps, isDragging }) => (
                    <div ref={setNodeRef} style={style} className={`flex items-center gap-3 rounded-[var(--radius-md)] border border-brand-border bg-brand-surface p-3 ${isDragging ? "opacity-60" : ""}`}>
                      <button type="button" {...dragHandleProps} aria-label="Etiket sırasını değiştir" className="text-brand-muted hover:text-brand-text">
                        <SortableDragHandleIcon />
                      </button>
                      <input className={`${fieldInput} mt-0 flex-1`} value={row.value} maxLength={60} required onChange={(event) => setOfferingLabels((current) => current.map((r) => (r.id === row.id ? { ...r, value: event.target.value } : r)))} />
                    </div>
                  )}
                />
              </div>
            </EditorSection>

            <EditorSection title="Kayan yazı kelimeleri" id="about-marquee" description={`1 ile ${MAX_MARQUEE_WORDS} kelime arası; sıra, ekleme ve çıkarma serbest.`}>
              <div className="space-y-4">
                <SortableList
                  items={marquee}
                  onReorder={reorderMarquee}
                  renderItem={(row, { setNodeRef, style, dragHandleProps, isDragging }) => (
                    <div ref={setNodeRef} style={style} className={`flex items-center gap-3 rounded-[var(--radius-md)] border border-brand-border bg-brand-surface p-3 ${isDragging ? "opacity-60" : ""}`}>
                      <button type="button" {...dragHandleProps} aria-label="Kelime sırasını değiştir" className="text-brand-muted hover:text-brand-text">
                        <SortableDragHandleIcon />
                      </button>
                      <input className={`${fieldInput} mt-0 flex-1`} value={row.value} maxLength={60} required onChange={(event) => setMarquee((current) => current.map((r) => (r.id === row.id ? { ...r, value: event.target.value } : r)))} />
                      <button type="button" aria-label="Kelimeyi kaldır" disabled={marquee.length <= 1} onClick={() => setMarquee((current) => current.filter((r) => r.id !== row.id))} className="text-brand-muted hover:text-brand-danger disabled:opacity-30">
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  )}
                />
                <button
                  type="button"
                  disabled={marquee.length >= MAX_MARQUEE_WORDS}
                  onClick={() => setMarquee((current) => [...current, { id: `word-${current.length}`, value: "" }])}
                  className={`${secondaryButton} disabled:opacity-40`}
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Kelime ekle
                </button>
              </div>
            </EditorSection>

            <EditorSection title="Ekip bölümü başlığı" id="about-team-heading" description="About sayfasındaki ekip vitrini başlığı.">
              <FieldGrid>
                <label className={fieldLabel}>
                  Küçük başlık
                  <input name="teamSubtitle" className={fieldInput} defaultValue={payload?.teamSubtitle ?? ""} maxLength={150} required />
                </label>
                <label className={fieldLabel}>
                  Başlık
                  <input name="teamTitle" className={fieldInput} defaultValue={payload?.teamTitle ?? ""} maxLength={150} required />
                </label>
              </FieldGrid>
            </EditorSection>

            <EditorSection title="Yazar bilgisi" id="about-author" description="&ldquo;Daha Fazla&rdquo; butonunun yanında görünen imza bilgisi.">
              <div className="space-y-5">
                <FieldGrid>
                  <label className={fieldLabel}>
                    Ad Soyad
                    <input name="authorName" className={fieldInput} defaultValue={payload?.authorName ?? ""} maxLength={100} required />
                  </label>
                  <label className={fieldLabel}>
                    Unvan
                    <input name="authorRole" className={fieldInput} defaultValue={payload?.authorRole ?? ""} maxLength={100} required />
                  </label>
                </FieldGrid>
                <MediaField label="Fotoğraf" value={authorImage.url} assetId={authorImage.assetId} onChange={(next) => setAuthorImage({ url: next.url, assetId: next.assetId })} />
              </div>
            </EditorSection>

            <EditorSection title="SEO" id="about-seo" description="Opsiyonel arama motoru başlığı ve açıklaması.">
              <FieldGrid>
                <label className={fieldLabel}>
                  SEO başlığı
                  <input name="seoTitle" className={fieldInput} defaultValue={payload?.seoTitle ?? ""} maxLength={70} />
                  <span className={fieldHint}>Boşsa üst başlık (banner) kullanılır.</span>
                </label>
                <label className={fieldLabel}>
                  SEO açıklaması
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
          />
        }
      />
    </form>
  );
}
