"use client";

import { TranslationAssistant } from "@/components/admin/TranslationAssistant";
import { useCallback, useEffect, useState, useTransition } from "react";
import type { ContentLocale, HomeSectionKey } from "@prisma/client";
import { AlertTriangle, Check, ChevronDown, ChevronRight, Eye, EyeOff, Save } from "lucide-react";
import { primaryButton, secondaryButton } from "@/components/admin/ui";
import { SortableList, SortableDragHandleIcon } from "@/components/admin/SortableList";
import type { MediaAssetPreview } from "@/lib/content-model/content-media";
import type { FixedHomeSectionData } from "@/lib/content-model/home-fixed-admin";
import type { HomeWidgetConfig } from "@/lib/content-model/home-section-schemas";
import { HomeSectionFieldsEditor } from "./HomeSectionFieldsEditor";
import {
  saveHomeSectionDirectAction,
  reorderHomeSectionsAction,
  importHomeTranslationsAction,
  setHomeSectionVisibilityAction,
} from "./home-accordion-actions";

const LOCALES: readonly ContentLocale[] = ["tr", "en"];
export function HomeAccordionList({
  initialSections,
  mediaAssetsById,
  brandName,
}: {
  initialSections: readonly FixedHomeSectionData[];
  mediaAssetsById: Readonly<Record<string, MediaAssetPreview>>;
  brandName: string;
}) {
  const [sections, setSections] = useState<readonly FixedHomeSectionData[]>(initialSections);
  const [expandedKey, setExpandedKey] = useState<HomeSectionKey | null>("hero");
  const [activeLocale, setActiveLocale] = useState<ContentLocale>("tr");
  const [toast, setToast] = useState<string | null>(null);
  const [isSaving, startSaving] = useTransition();

  const showToast = useCallback((message: string, duration = 2800) => {
    setToast(message);
    window.setTimeout(() => setToast(null), duration);
  }, []);

  const saveSection = useCallback(
    (sectionKey: HomeSectionKey, publish = true) => {
      const section = sections.find((candidate) => candidate.key === sectionKey);
      if (!section) return;
      const payload = section.localePayloads[activeLocale];
      startSaving(async () => {
        const result = await saveHomeSectionDirectAction(
          sectionKey,
          activeLocale,
          payload.blocks,
          payload.widget,
          publish,
        );
        if (result.status === "success") {
          setSections((current) =>
            current.map((item) =>
              item.key === sectionKey
                ? {
                    ...item,
                    localeStatuses: {
                      ...item.localeStatuses,
                      [activeLocale]: publish ? "published" : "draft",
                    },
                  }
                : item,
            ),
          );
          showToast(
            `${section.label} (${activeLocale.toUpperCase()}) ${publish ? "kaydedildi ve yayınlandı" : "kaydedildi"}.`,
          );
        } else {
          showToast(`Hata: ${result.message}`, 3800);
        }
      });
    },
    [activeLocale, sections, showToast],
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s" && expandedKey) {
        event.preventDefault();
        saveSection(expandedKey, false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [expandedKey, saveSection]);

  function updateWidget(sectionKey: HomeSectionKey, widget: HomeWidgetConfig) {
    setSections((current) =>
      current.map((section) => {
        if (section.key !== sectionKey) return section;
        const localePayload = section.localePayloads[activeLocale];
        return {
          ...section,
          localePayloads: {
            ...section.localePayloads,
            [activeLocale]: { ...localePayload, widget },
          },
        };
      }),
    );
  }

  function toggleVisibility(sectionKey: HomeSectionKey, enabled: boolean) {
    // Optimistic: the row's icon flips immediately, and a refused write
    // rolls it back with the reason in the toast.
    setSections((current) => current.map((item) => (item.key === sectionKey ? { ...item, enabled } : item)));
    startSaving(async () => {
      const result = await setHomeSectionVisibilityAction(sectionKey, enabled);
      if (result.status === "error") {
        setSections((current) => current.map((item) => (item.key === sectionKey ? { ...item, enabled: !enabled } : item)));
        showToast(`Hata: ${result.message}`, 3800);
        return;
      }
      showToast(result.message);
    });
  }

  // One prompt for the whole homepage: every section's Turkish payload keyed
  // by its registry key, translated in a single round trip instead of eleven.
  const homeTranslationSource = Object.fromEntries(
    sections.map((section) => [section.key, section.localePayloads.tr]),
  );

  async function applyHomeTranslations(translations: Record<string, unknown>) {
    const result = await importHomeTranslationsAction(translations);
    if (result.status === "error") return { error: result.message };
    return { success: result.message };
  }

  return (
    <div className="space-y-3">
      {toast ? (
        <div className="fixed bottom-6 end-6 z-50 flex items-center gap-2 rounded-[var(--radius-lg)] border border-brand-border bg-brand-surface px-4 py-3 text-sm font-semibold shadow-lg">
          <Check className="size-4 text-brand-success" aria-hidden="true" />
          {toast}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-md)] border border-brand-border bg-brand-surface px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-brand-text">Anasayfa bölüm sıralaması.</p>
          <p className="mt-1 text-xs leading-5 text-brand-muted">
            Bölümleri sürükleyerek (grip ikonundan tutarak) sıralayın. Çeviri tüm bölümler için tek seferde yapılır.
          </p>
        </div>
        <TranslationAssistant source={homeTranslationSource} onApply={applyHomeTranslations} />
      </div>

      <SortableList
        items={sections.map((section) => ({ id: section.key }))}
        onReorder={(nextOrderedIds) => {
          const nextSections = nextOrderedIds
            .map((key) => sections.find((s) => s.key === key))
            .filter(Boolean) as FixedHomeSectionData[];
          setSections(nextSections);
          startSaving(async () => {
            await reorderHomeSectionsAction(nextOrderedIds as readonly HomeSectionKey[]);
          });
        }}
        renderItem={(item, { setNodeRef, style, dragHandleProps, isDragging }) => {
          const section = sections.find((s) => s.key === item.id)!;
          const isExpanded = expandedKey === section.key;
          const payload = section.localePayloads[activeLocale];
          return (
            <div ref={setNodeRef} style={style} className="mb-3 rounded-[var(--radius-md)] border border-brand-border bg-brand-surface">
              <div className="flex w-full items-center justify-between gap-4 p-4 hover:bg-brand-page/60">
                <div className="flex items-center gap-3">
                  <button type="button" aria-label="Sürükleyerek sırala" {...dragHandleProps} className="cursor-grab text-brand-muted hover:text-brand-text">
                    <SortableDragHandleIcon />
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpandedKey(isExpanded ? null : section.key)}
                    className="flex items-center gap-2 text-start font-bold text-brand-text"
                  >
                    {isExpanded ? <ChevronDown className="size-4 text-brand-muted" /> : <ChevronRight className="size-4 text-brand-muted" />}
                    <span className="text-sm font-bold text-brand-text">{section.label}</span>
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-brand-muted">
                    {section.enabled ? "Sayfada" : "Gizli"}
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleVisibility(section.key, !section.enabled)}
                    disabled={isSaving}
                    aria-pressed={section.enabled}
                    aria-label={section.enabled ? `${section.label} bölümünü gizle` : `${section.label} bölümünü göster`}
                    title={section.enabled ? "Bölümü gizle" : "Bölümü göster"}
                    className="rounded-[var(--radius-sm)] p-1.5 text-brand-muted transition-colors hover:bg-brand-page hover:text-brand-text disabled:opacity-40"
                  >
                    {section.enabled ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                  </button>
                </div>
              </div>

              {isExpanded ? (
                <div className="space-y-5 border-t border-brand-border bg-brand-page/30 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-brand-border pb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase text-brand-muted">Dil:</span>
                      {LOCALES.map((locale) => {
                        const missing = section.localeStatuses[locale] === "missing";
                        return (
                          <button
                            key={locale}
                            type="button"
                            onClick={() => setActiveLocale(locale)}
                            className={`inline-flex items-center gap-1 rounded-[var(--radius-sm)] px-3 py-1 text-xs font-bold uppercase transition-colors ${
                              activeLocale === locale
                                ? "bg-brand-primary text-brand-on-invert"
                                : "border border-brand-border bg-brand-surface text-brand-muted hover:text-brand-text"
                            }`}
                          >
                            {locale}
                            {missing && locale !== "tr" ? <AlertTriangle className="size-2.5" /> : null}
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={() => saveSection(section.key, false)}
                        className={secondaryButton}
                      >
                        <Save className="size-3.5" />
                        {isSaving ? "Kaydediliyor…" : "Kaydet"}
                      </button>
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={() => saveSection(section.key, true)}
                        className={primaryButton}
                      >
                        {isSaving ? "Kaydediliyor…" : "Kaydet ve yayınla"}
                      </button>
                    </div>
                  </div>

                  <HomeSectionFieldsEditor
                    sectionKey={section.key}
                    locale={activeLocale}
                    config={payload.widget}
                    mediaAssetsById={mediaAssetsById}
                    brandName={brandName}
                    onChange={(widget) => updateWidget(section.key, widget)}
                  />
                </div>
              ) : null}
            </div>
          );
        }}
      />
    </div>
  );
}
