"use client";

import { SettingsOwnedCopy } from "./SettingsOwnedCopy";
import Link from "next/link";
import { useEffect, useId, useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { Locale } from "@/lib/i18n/config";
import type {
  FooterColumnPayload,
  FooterLinkPayload,
  NavChildPayload,
  NavItemPayload,
  NavTargetPayload,
  SiteSettingsPayload,
} from "@/lib/content-model/site-settings-schema";
import {
  getSiteSettingsEditViewAction,
  listNavTargetCandidatesAction,
  publishSiteSettingsAction,
  saveAndPublishSiteSettingsAction,
  resolveNavigationStatusAction,
  saveSiteSettingsDraftAction,
  type NavTargetCandidate,
  type SiteSettingsEditViewData,
} from "./actions";
import { EditorPageLayout } from "@/components/admin/EditorPageLayout";
import { EditorSection } from "@/components/admin/EditorSection";
import { FieldGrid } from "@/components/admin/FieldGrid";
import { InfoCard } from "@/components/admin/InfoCard";
import { SettingsCategoryNav, type SettingsCategoryItem } from "@/components/admin/SettingsCategoryNav";
import { fieldHint, fieldInput, fieldLabel, primaryButton, secondaryButton } from "@/components/admin/ui";
import { FormStatus } from "@/components/admin/StateSurfaces";
import { MediaField } from "@/components/admin/MediaField";
import { LazyEditorBoundary } from "@/components/admin/LazyEditorBoundary";
import { RichTextEditor } from "@/components/admin/RichTextEditor";
import { SortableList, SortableDragHandleIcon } from "@/components/admin/SortableList";
import { TranslationAssistant } from "@/components/admin/TranslationAssistant";
import { ToneBadge } from "@/components/admin/StatusBadge";
import type { ResolvedNavItem } from "@/lib/content-model/site-settings-nav";

const LOCALES: readonly Locale[] = ["tr", "en"];
const LOCALE_LABEL: Record<Locale, string> = { tr: "TR", en: "Global" };
const STATUS_LABEL: Record<string, string> = { missing: "Bu dilde yok", draft: "Kaydedildi", published: "Yayında" };
const STATUS_TONE: Record<string, "muted" | "warning" | "success"> = {
  missing: "muted",
  draft: "warning",
  published: "success",
};

const NAV_TARGET_CONTENT_TYPES: readonly Readonly<{ value: string; label: string }>[] = [
  { value: "service", label: "Hizmet" },
  { value: "product", label: "Ürün" },
  { value: "project", label: "Proje" },
  { value: "post", label: "Blog yazısı" },
  { value: "faq", label: "SSS" },
];

function randomId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `id-${Date.now()}-${Math.random()}`;
}

function emptyPayload(): SiteSettingsPayload {
  return {
    brand: { name: "", logoAssetId: null },
    contact: { email: null, phone: null, address: null },
    cta: { label: null, url: null },
    navigation: [],
    footer: { summary: "", columns: [] },
    mission: "",
    vision: "",
    termsBody: "",
    privacyBody: "",
  };
}

export type SiteSettingsSectionKey =
  | "general"
  | "navigation"
  | "contact"
  | "social"
  | "mission-vision"
  | "legal"
  | "page-copy"
  | "default-seo"
  | "advanced";

const SETTINGS_SECTIONS: readonly SettingsCategoryItem<SiteSettingsSectionKey>[] = [
  { key: "general", label: "Genel", description: "Marka adı, logo ve temel kimlik." },
  { key: "navigation", label: "Navigasyon", description: "Header bağlantıları, CTA ve footer." },
  { key: "contact", label: "İletişim", description: "E-posta, telefon ve adres bilgileri." },
  { key: "social", label: "Sosyal", description: "Sosyal hesap sahipliği ve boş durum." },
  { key: "mission-vision", label: "Misyon ve Vizyon", description: "Kurumsal hedef metinleri." },
  { key: "legal", label: "Yasal", description: "Şartlar ve gizlilik metinleri." },
  { key: "page-copy", label: "Liste sayfa metinleri", description: "Hizmet, ürün, proje, blog, SSS ve yasal sayfa yazıları." },
  { key: "default-seo", label: "Varsayılan SEO", description: "Mevcut SEO sahipliği ve yönlendirme." },
  { key: "advanced", label: "Gelişmiş", description: "Teknik ayarlar ve gelecek güvenli modlar." },
] as const;

export function isSiteSettingsSectionKey(value: unknown): value is SiteSettingsSectionKey {
  return typeof value === "string" && SETTINGS_SECTIONS.some((section) => section.key === value);
}

/** Full-page editor for the singleton site-settings entity. Locale tabs share one hydrated `EntityEditView`; create, archive, and reorder do not apply because there is exactly one record. */
export function SiteSettingsEditor({
  initialLocale,
  initialSection = "general",
}: {
  initialLocale: Locale;
  initialSection?: SiteSettingsSectionKey;
}) {
  const [data, setData] = useState<SiteSettingsEditViewData | "loading" | "error">("loading");
  const [currentSection, setCurrentSection] = useState<SiteSettingsSectionKey>(initialSection);

  useEffect(() => {
    let cancelled = false;
    getSiteSettingsEditViewAction()
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch(() => {
        if (!cancelled) setData("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (data === "loading") {
    return (
      <p className="text-sm text-brand-muted" role="status">
        Yükleniyor…
      </p>
    );
  }
  if (data === "error") {
    return <p className="text-sm text-brand-danger">Site ayarları yüklenemedi.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2" aria-label="Site ayarları dilleri">
        {LOCALES.map((locale) => {
          const translation = data.view.translations[locale];
          const status = translation?.status ?? "missing";
          return (
            <Link
              key={locale}
              href={`/manage/site-settings?locale=${locale}&section=${currentSection}`}
              aria-current={initialLocale === locale ? "page" : undefined}
              className={`flex items-center gap-1.5 rounded-[var(--radius-sm)] border px-3 py-1.5 text-sm font-medium transition ${
                initialLocale === locale
                  ? "border-brand-primary bg-brand-primary/10 text-brand-primary"
                  : "border-brand-border bg-brand-surface text-brand-text hover:bg-brand-page"
              }`}
            >
              {LOCALE_LABEL[locale]}
              <ToneBadge tone={STATUS_TONE[status]} label={STATUS_LABEL[status]} />
            </Link>
          );
        })}
        </div>
        <TranslationAssistant entityId={data.entityId} />
      </div>
      <SiteSettingsLocaleForm key={initialLocale} locale={initialLocale} initialSection={currentSection} editView={data} onSectionChange={setCurrentSection} />
    </div>
  );
}

function SiteSettingsLocaleForm({
  locale,
  initialSection,
  editView,
  onSectionChange,
}: {
  locale: Locale;
  initialSection: SiteSettingsSectionKey;
  editView: SiteSettingsEditViewData;
  onSectionChange: (section: SiteSettingsSectionKey) => void;
}) {
  const translation = editView.view.translations[locale];
  const initialPayload = (translation?.draftPayload ?? translation?.publishedPayload ?? null) as SiteSettingsPayload | null;
  const [localeStatus, setLocaleStatus] = useState(translation?.status ?? "missing");

  const [payload, setPayload] = useState<SiteSettingsPayload>(initialPayload ?? emptyPayload());
  const [dirty, setDirty] = useState(false);
  const [logo, setLogo] = useState<{ url: string; assetId?: string }>({
    url: initialPayload?.brand.logoAssetId ? (editView.assetPreviews[initialPayload.brand.logoAssetId]?.url ?? "") : "",
    assetId: initialPayload?.brand.logoAssetId ?? undefined,
  });
  const [draftState, setDraftState] = useState<{ error?: string; success?: string }>({});
  const [publishState, setPublishState] = useState<{ error?: string; success?: string }>({});
  const [translationMeta, setTranslationMeta] = useState({
    translationId: translation?.translationId ?? "",
    version: translation?.version ?? 0,
    draftRevisionId: translation?.draftRevisionId ?? "",
  });
  const [isSavingDraft, startSaveDraft] = useTransition();
  const [isPublishing, startPublish] = useTransition();
  const formId = useId();
  const [activeSection, setActiveSection] = useState<SiteSettingsSectionKey>(initialSection);

  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  function update(mutate: (draft: SiteSettingsPayload) => SiteSettingsPayload) {
    setPayload((prev) => mutate(prev));
    setDirty(true);
  }

  function toFormData(): FormData {
    const fd = new FormData();
    fd.set("locale", locale);
    fd.set("translationId", translationMeta.translationId);
    fd.set("expectedVersion", String(translationMeta.version));
    fd.set("draftRevisionId", translationMeta.draftRevisionId);
    fd.set("brand.name", payload.brand.name);
    fd.set("brand.logoAssetId", logo.assetId ?? "");
    fd.set("contact.email", payload.contact.email ?? "");
    fd.set("contact.phone", payload.contact.phone ?? "");
    fd.set("contact.address", payload.contact.address ?? "");
    fd.set("cta.label", payload.cta.label ?? "");
    fd.set("cta.url", payload.cta.url ?? "");
    fd.set("navigation", JSON.stringify(payload.navigation));
    fd.set("footer.summary", payload.footer.summary);
    fd.set("footerColumns", JSON.stringify(payload.footer.columns));
    fd.set("mission", payload.mission);
    fd.set("vision", payload.vision);
    fd.set("termsBody", payload.termsBody);
    fd.set("privacyBody", payload.privacyBody);
    return fd;
  }

  function handleSaveDraft() {
    startSaveDraft(async () => {
      const result = await saveSiteSettingsDraftAction({}, toFormData());
      setPublishState({});
      setDraftState(result);
      if (!result.error) {
        setDirty(false);
        setLocaleStatus("draft");
        const fresh = await getSiteSettingsEditViewAction();
        const freshTranslation = fresh.view.translations[locale];
        if (freshTranslation) {
          setTranslationMeta({
            translationId: freshTranslation.translationId,
            version: freshTranslation.version,
            draftRevisionId: freshTranslation.draftRevisionId ?? "",
          });
        }
      }
    });
  }

  function handlePublish() {
    startPublish(async () => {
      const result = await saveAndPublishSiteSettingsAction({}, toFormData());
      setDraftState({});
      setPublishState(result);
      if (!result.error) {
        setLocaleStatus("published");
        const fresh = await getSiteSettingsEditViewAction();
        const freshTranslation = fresh.view.translations[locale];
        if (freshTranslation) {
          setTranslationMeta({
            translationId: freshTranslation.translationId,
            version: freshTranslation.version,
            draftRevisionId: freshTranslation.draftRevisionId ?? "",
          });
        }
      }
    });
  }

  function selectSection(section: SiteSettingsSectionKey) {
    setActiveSection(section);
    window.history.replaceState(null, "", `/manage/site-settings?locale=${locale}&section=${section}`);
    onSectionChange(section);
  }

  const actionError = draftState.error ?? publishState.error;
  const actionSuccess = draftState.success ?? publishState.success;

  const generalSection = (
    <EditorSection
      id={`${formId}-general`}
      title="Genel"
      description="Marka adı ve logo; header, footer ve public marka görünümünü etkiler."
      defaultOpen
    >
      <FieldGrid>
        <label className={fieldLabel}>
          Marka adı
          <input
            className={fieldInput}
            value={payload.brand.name}
            onChange={(event) => update((draft) => ({ ...draft, brand: { ...draft.brand, name: event.target.value } }))}
            maxLength={120}
            required
          />
        </label>
        <MediaField
          label="Logo"
          value={logo.url}
          assetId={logo.assetId}
          onChange={(next) => {
            setLogo({ url: next.url, assetId: next.assetId });
            setDirty(true);
          }}
        />
      </FieldGrid>
    </EditorSection>
  );

  const ctaSection = (
    <EditorSection
      id={`${formId}-cta`}
      title="Header CTA"
      description="Ana navigasyondaki aksiyon düğmesinin metni ve hedefi."
      defaultOpen
    >
      <FieldGrid>
        <label className={fieldLabel}>
          CTA metni
          <input
            className={fieldInput}
            value={payload.cta.label ?? ""}
            onChange={(event) =>
              update((draft) => ({ ...draft, cta: { ...draft.cta, label: event.target.value || null } }))
            }
            maxLength={60}
          />
        </label>
        <label className={fieldLabel}>
          CTA adresi
          <input
            className={fieldInput}
            value={payload.cta.url ?? ""}
            onChange={(event) => update((draft) => ({ ...draft, cta: { ...draft.cta, url: event.target.value || null } }))}
            maxLength={200}
          />
          <span className={fieldHint}>&quot;/&quot; ile başlayan site-içi yol veya http(s) adresi.</span>
        </label>
      </FieldGrid>
    </EditorSection>
  );

  const contactSection = (
    <EditorSection
      id={`${formId}-contact`}
      title="İletişim"
      description="Footer, iletişim sayfası ve header yardımcı bağlantılarında kullanılan bilgiler."
      defaultOpen
    >
      <FieldGrid columns={3}>
        <label className={fieldLabel}>
          E-posta
          <input
            className={fieldInput}
            value={payload.contact.email ?? ""}
            onChange={(event) =>
              update((draft) => ({ ...draft, contact: { ...draft.contact, email: event.target.value || null } }))
            }
            maxLength={160}
          />
        </label>
        <label className={fieldLabel}>
          Telefon
          <input
            className={fieldInput}
            value={payload.contact.phone ?? ""}
            onChange={(event) =>
              update((draft) => ({ ...draft, contact: { ...draft.contact, phone: event.target.value || null } }))
            }
            maxLength={40}
          />
        </label>
        <label className={fieldLabel}>
          Adres
          <input
            className={fieldInput}
            value={payload.contact.address ?? ""}
            onChange={(event) =>
              update((draft) => ({ ...draft, contact: { ...draft.contact, address: event.target.value || null } }))
            }
            maxLength={240}
          />
        </label>
      </FieldGrid>
    </EditorSection>
  );

  const missionVisionSection = (
    <EditorSection
      id={`${formId}-mission-vision`}
      title="Misyon ve Vizyon"
      description="Kurumsal sayfalarda ve public anlatımda kullanılan uzun olmayan metinler."
      defaultOpen
    >
      <FieldGrid>
        <label className={fieldLabel}>
          Misyon
          <textarea
            className={`${fieldInput} resize-y`}
            rows={5}
            value={payload.mission}
            onChange={(event) => update((draft) => ({ ...draft, mission: event.target.value }))}
            maxLength={600}
          />
        </label>
        <label className={fieldLabel}>
          Vizyon
          <textarea
            className={`${fieldInput} resize-y`}
            rows={5}
            value={payload.vision}
            onChange={(event) => update((draft) => ({ ...draft, vision: event.target.value }))}
            maxLength={600}
          />
        </label>
      </FieldGrid>
    </EditorSection>
  );

  const legalSection = (
    <div className="space-y-4">
      <EditorSection
        id={`${formId}-terms`}
        title="Kullanım şartları"
        description="Yasal sayfada yayınlanan kullanım şartları metni."
        defaultOpen
      >
        <LazyEditorBoundary fallback="Kullanım şartları düzenleyicisi yükleniyor…">
          <RichTextEditor
            label="Kullanım şartları"
            value={payload.termsBody}
            onChange={(value) => update((draft) => ({ ...draft, termsBody: value }))}
            maxLength={40000}
          />
        </LazyEditorBoundary>
      </EditorSection>
      <EditorSection
        id={`${formId}-privacy`}
        title="Gizlilik politikası"
        description="Yasal sayfada yayınlanan gizlilik metni."
      >
        <LazyEditorBoundary fallback="Gizlilik politikası düzenleyicisi yükleniyor…">
          <RichTextEditor
            label="Gizlilik politikası"
            value={payload.privacyBody}
            onChange={(value) => update((draft) => ({ ...draft, privacyBody: value }))}
            maxLength={40000}
          />
        </LazyEditorBoundary>
      </EditorSection>
    </div>
  );

  const emptyOwnershipSection = (title: string, description: string) => (
    <InfoCard title={title} description={description}>
      <p className="text-sm leading-6 text-brand-muted">
        Bu payload şemasında düzenlenecek alan yok. Alan eklenmesi Spec 7 kapsamı dışındadır; veri modeli değişmeden boş durum gösterilir.
      </p>
    </InfoCard>
  );

  const activeContent =
    activeSection === "general" ? (
      generalSection
    ) : activeSection === "navigation" ? (
      <div className="space-y-4">
        {ctaSection}
        <NavigationSection locale={locale} items={payload.navigation} onChange={(navigation) => update((draft) => ({ ...draft, navigation }))} />
        <FooterSection
          summary={payload.footer.summary}
          columns={payload.footer.columns}
          onChangeSummary={(summary) => update((draft) => ({ ...draft, footer: { ...draft.footer, summary } }))}
          onChangeColumns={(columns) => update((draft) => ({ ...draft, footer: { ...draft.footer, columns } }))}
        />
      </div>
    ) : activeSection === "contact" ? (
      contactSection
    ) : activeSection === "social" ? (
      emptyOwnershipSection("Sosyal hesaplar", "Mevcut site-settings payload'ında sosyal hesap alanı bulunmuyor; ikinci veri kaynağı oluşturulmaz.")
    ) : activeSection === "mission-vision" ? (
      missionVisionSection
    ) : activeSection === "legal" ? (
      legalSection
    ) : activeSection === "page-copy" ? (
      <SettingsOwnedCopy />
    ) : activeSection === "default-seo" ? (
      emptyOwnershipSection("Varsayılan SEO", "Mevcut SEO başlık/açıklama alanları kendi içerik payload'larında kalır; gelişmiş SEO Spec 11 kapsamıdır.")
    ) : (
      emptyOwnershipSection("Gelişmiş", "Developer Mode ve teknik ayarlar Spec 14'te güvenli yetki modeliyle eklenecektir.")
    );

  return (
    <EditorPageLayout
      main={<div className="space-y-4">{activeContent}</div>}
      aside={
        <div className="space-y-4">
          <SettingsCategoryNav items={SETTINGS_SECTIONS} activeKey={activeSection} onChange={selectSection} label="Site ayarları bölümleri" />
          <InfoCard title={`${locale.toUpperCase()} yayın durumu`} description="Bu ayar kaydı tekil bir içeriktir; kaydetme ve yayınlama yalnız seçili dili etkiler.">
            <div className="flex flex-wrap items-center gap-2">
              <ToneBadge tone={STATUS_TONE[localeStatus]} label={STATUS_LABEL[localeStatus]} />
              {translation ? <span className="text-xs text-brand-muted">v{translationMeta.version}</span> : null}
            </div>
            {dirty ? (
              <span role="status" className="block text-xs font-medium text-brand-warning">
                Kaydedilmemiş değişiklikler var
              </span>
            ) : null}
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={handlePublish}
                disabled={isPublishing || isSavingDraft}
                className={primaryButton}
              >
                {isPublishing ? "Yayınlanıyor…" : "Kaydet ve yayınla"}
              </button>
              <button type="button" onClick={handleSaveDraft} disabled={isSavingDraft || isPublishing} className={secondaryButton}>
                {isSavingDraft ? "Kaydediliyor…" : "Kaydet"}
              </button>
            </div>
            <FormStatus error={actionError} success={actionSuccess} />
          </InfoCard>
        </div>
      }
    />
  );
}

function NavTargetEditor({
  target,
  onChange,
}: {
  target: NavTargetPayload;
  onChange: (target: NavTargetPayload) => void;
}) {
  const [candidates, setCandidates] = useState<readonly NavTargetCandidate[]>([]);
  const contentType = target.kind === "collection" ? target.contentType : NAV_TARGET_CONTENT_TYPES[0].value;

  useEffect(() => {
    if (target.kind !== "collection") return;
    let cancelled = false;
    listNavTargetCandidatesAction(contentType).then((result) => {
      if (!cancelled) setCandidates(result);
    });
    return () => {
      cancelled = true;
    };
  }, [target.kind, contentType]);

  return (
    <div className="grid gap-2 sm:grid-cols-[140px_1fr]">
      <select
        className={fieldInput}
        value={target.kind}
        onChange={(event) => {
          if (event.target.value === "external") onChange({ kind: "external", url: "" });
          else onChange({ kind: "collection", contentType: NAV_TARGET_CONTENT_TYPES[0].value, entityId: "" });
        }}
      >
        <option value="external">Harici URL</option>
        <option value="collection">İçerik</option>
      </select>
      {target.kind === "external" ? (
        <input
          className={fieldInput}
          value={target.url}
          onChange={(event) => onChange({ kind: "external", url: event.target.value })}
          placeholder="/hakkimizda veya https://…"
        />
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          <select
            className={fieldInput}
            value={target.contentType}
            onChange={(event) => onChange({ kind: "collection", contentType: event.target.value, entityId: "" })}
          >
            {NAV_TARGET_CONTENT_TYPES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            className={fieldInput}
            value={target.entityId}
            onChange={(event) => onChange({ kind: "collection", contentType: target.contentType, entityId: event.target.value })}
          >
            <option value="">Seçin…</option>
            {candidates.map((candidate) => (
              <option key={candidate.entityId} value={candidate.entityId} disabled={candidate.archived}>
                {candidate.label}
                {candidate.archived ? " (arşivde)" : ""}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

function NavigationSection({
  locale,
  items,
  onChange,
}: {
  locale: Locale;
  items: readonly NavItemPayload[];
  onChange: (items: readonly NavItemPayload[]) => void;
}) {
  const [statusById, setStatusById] = useState<ReadonlyMap<string, ResolvedNavItem>>(new Map());
  const [checking, setChecking] = useState(false);

  async function checkStatuses() {
    setChecking(true);
    const resolved = await resolveNavigationStatusAction(locale, items);
    setStatusById(new Map(resolved.map((item) => [item.id, item])));
    setChecking(false);
  }

  function addItem() {
    onChange([...items, { id: randomId(), label: "", target: { kind: "external", url: "" }, children: [] }]);
  }

  function updateItem(id: string, next: NavItemPayload) {
    onChange(items.map((item) => (item.id === id ? next : item)));
  }

  function removeItem(id: string) {
    onChange(items.filter((item) => item.id !== id));
  }

  return (
    <EditorSection
      id="settings-navigation"
      title="Navigasyon bağlantıları"
      description="Header menüsü ve alt bağlantılar; hedefler yayınlanmış route registry ile doğrulanır."
      defaultOpen
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-brand-muted">Ana menü sırasını sürükleyerek düzenleyin.</p>
          <div className="flex gap-2">
            <button type="button" onClick={checkStatuses} disabled={checking || items.length === 0} className={secondaryButton}>
              {checking ? "Kontrol ediliyor…" : "Hedefleri doğrula"}
            </button>
            <button type="button" onClick={addItem} className={secondaryButton}>
              <Plus className="h-4 w-4" aria-hidden="true" /> Öğe ekle
            </button>
          </div>
        </div>
        {items.length === 0 ? <p className="text-sm text-brand-muted">Henüz navigasyon öğesi yok.</p> : null}
        <SortableList
          items={items.map((item) => ({ id: item.id }))}
          onReorder={(nextIds) => onChange(nextIds.map((id) => items.find((item) => item.id === id)!))}
          renderItem={(row, sortable) => {
            const item = items.find((candidate) => candidate.id === row.id)!;
            const resolvedStatus = statusById.get(item.id);
            return (
              <div ref={sortable.setNodeRef} style={sortable.style} className="rounded-[var(--radius-md)] border border-brand-border bg-brand-surface p-3">
                <div className="flex items-start gap-2">
                  <button type="button" aria-label="Sürükleyerek sırala" {...sortable.dragHandleProps} className="mt-2 cursor-grab text-brand-muted">
                    <SortableDragHandleIcon />
                  </button>
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        className={fieldInput}
                        value={item.label}
                        onChange={(event) => updateItem(item.id, { ...item, label: event.target.value })}
                        placeholder="Etiket"
                        maxLength={80}
                      />
                      {resolvedStatus ? (
                        <ToneBadge tone={resolvedStatus.resolved.ok ? "success" : "danger"} label={resolvedStatus.resolved.ok ? "Bağlı" : resolvedStatus.resolved.reason} />
                      ) : null}
                      <button type="button" onClick={() => removeItem(item.id)} className="text-brand-danger" aria-label="Öğeyi sil">
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                    <NavTargetEditor target={item.target} onChange={(target) => updateItem(item.id, { ...item, target })} />
                    <NavChildrenEditor children_={item.children} onChange={(children) => updateItem(item.id, { ...item, children })} />
                  </div>
                </div>
              </div>
            );
          }}
        />
      </div>
    </EditorSection>
  );
}

function NavChildrenEditor({
  children_,
  onChange,
}: {
  children_: readonly NavChildPayload[];
  onChange: (children: readonly NavChildPayload[]) => void;
}) {
  function addChild() {
    onChange([...children_, { id: randomId(), label: "", target: { kind: "external", url: "" } }]);
  }
  function updateChild(id: string, next: NavChildPayload) {
    onChange(children_.map((child) => (child.id === id ? next : child)));
  }
  function removeChild(id: string) {
    onChange(children_.filter((child) => child.id !== id));
  }

  return (
    <div className="ms-6 space-y-2 border-s border-brand-border ps-3">
      {children_.map((child) => (
        <div key={child.id} className="flex items-start gap-2">
          <div className="flex-1 space-y-1">
            <input
              className={fieldInput}
              value={child.label}
              onChange={(event) => updateChild(child.id, { ...child, label: event.target.value })}
              placeholder="Alt öğe etiketi"
              maxLength={80}
            />
            <NavTargetEditor target={child.target} onChange={(target) => updateChild(child.id, { ...child, target })} />
          </div>
          <button type="button" onClick={() => removeChild(child.id)} className="mt-2 text-brand-danger" aria-label="Alt öğeyi sil">
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      ))}
      <button type="button" onClick={addChild} className="text-xs font-medium text-brand-primary">
        <Plus className="me-1 inline h-3 w-3" aria-hidden="true" /> Alt öğe ekle
      </button>
    </div>
  );
}

function FooterSection({
  summary,
  columns,
  onChangeSummary,
  onChangeColumns,
}: {
  summary: string;
  columns: readonly FooterColumnPayload[];
  onChangeSummary: (summary: string) => void;
  onChangeColumns: (columns: readonly FooterColumnPayload[]) => void;
}) {
  function addColumn() {
    onChangeColumns([...columns, { id: randomId(), title: "", links: [] }]);
  }
  function updateColumn(id: string, next: FooterColumnPayload) {
    onChangeColumns(columns.map((column) => (column.id === id ? next : column)));
  }
  function removeColumn(id: string) {
    onChangeColumns(columns.filter((column) => column.id !== id));
  }

  return (
    <EditorSection
      id="settings-footer"
      title="Footer"
      description="Footer özeti, kolon başlıkları ve bağlantıları."
      defaultOpen
    >
      <div className="space-y-4">
        <label className={fieldLabel}>
          Footer özeti
          <textarea className={`${fieldInput} resize-y`} rows={2} value={summary} onChange={(event) => onChangeSummary(event.target.value)} maxLength={400} />
        </label>

        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-brand-muted">Sütunlar</h3>
          <button type="button" onClick={addColumn} className={secondaryButton}>
            <Plus className="h-4 w-4" aria-hidden="true" /> Sütun ekle
          </button>
        </div>
        <SortableList
          items={columns.map((column) => ({ id: column.id }))}
          onReorder={(nextIds) => onChangeColumns(nextIds.map((id) => columns.find((column) => column.id === id)!))}
          renderItem={(row, sortable) => {
            const column = columns.find((candidate) => candidate.id === row.id)!;
            return (
              <div ref={sortable.setNodeRef} style={sortable.style} className="rounded-[var(--radius-md)] border border-brand-border bg-brand-surface p-3">
                <div className="flex items-start gap-2">
                  <button type="button" aria-label="Sürükleyerek sırala" {...sortable.dragHandleProps} className="mt-2 cursor-grab text-brand-muted">
                    <SortableDragHandleIcon />
                  </button>
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        className={fieldInput}
                        value={column.title}
                        onChange={(event) => updateColumn(column.id, { ...column, title: event.target.value })}
                        placeholder="Sütun başlığı"
                        maxLength={80}
                      />
                      <button type="button" onClick={() => removeColumn(column.id)} className="text-brand-danger" aria-label="Sütunu sil">
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                    <FooterColumnLinksEditor links={column.links} onChange={(links) => updateColumn(column.id, { ...column, links })} />
                  </div>
                </div>
              </div>
            );
          }}
        />
      </div>
    </EditorSection>
  );
}

function FooterColumnLinksEditor({
  links,
  onChange,
}: {
  links: readonly FooterLinkPayload[];
  onChange: (links: readonly FooterLinkPayload[]) => void;
}) {
  function addLink() {
    onChange([...links, { id: randomId(), label: "", target: { kind: "external", url: "" } }]);
  }
  function updateLink(id: string, next: FooterLinkPayload) {
    onChange(links.map((link) => (link.id === id ? next : link)));
  }
  function removeLink(id: string) {
    onChange(links.filter((link) => link.id !== id));
  }

  return (
    <div className="ms-6 space-y-2 border-s border-brand-border ps-3">
      {links.map((link) => (
        <div key={link.id} className="flex items-start gap-2">
          <div className="flex-1 space-y-1">
            <input
              className={fieldInput}
              value={link.label}
              onChange={(event) => updateLink(link.id, { ...link, label: event.target.value })}
              placeholder="Bağlantı etiketi"
              maxLength={80}
            />
            <NavTargetEditor target={link.target} onChange={(target) => updateLink(link.id, { ...link, target })} />
          </div>
          <button type="button" onClick={() => removeLink(link.id)} className="mt-2 text-brand-danger" aria-label="Bağlantıyı sil">
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      ))}
      <button type="button" onClick={addLink} className="text-xs font-medium text-brand-primary">
        <Plus className="me-1 inline h-3 w-3" aria-hidden="true" /> Bağlantı ekle
      </button>
    </div>
  );
}
