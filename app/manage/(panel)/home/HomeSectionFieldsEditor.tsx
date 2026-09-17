"use client";

import { useEffect, useMemo, useState } from "react";
import type { ContentLocale, HomeSectionKey } from "@prisma/client";
import { MediaField } from "@/components/admin/MediaField";
import { FieldGrid } from "@/components/admin/FieldGrid";
import { RichTextEditor } from "@/components/admin/RichTextEditor";
import { LazyEditorBoundary } from "@/components/admin/LazyEditorBoundary";
import { fieldHint, fieldInput, fieldLabel } from "@/components/admin/ui";
import type { MediaAssetPreview } from "@/lib/content-model/content-media";
import type {
  HomeCollectionSource,
  HomeWidgetConfig,
} from "@/lib/content-model/home-section-schemas";
import {
  getCollectionSelectableItemsAction,
  type SelectableCollectionItem,
} from "./collection-picker-actions";

import {
  DUMMY_ABOUT_IMAGE,
  DUMMY_AVATAR_IMAGES,
  DUMMY_HERO_IMAGE,
  dummyImage,
} from "@/lib/media/dummy-images";

/** Which managed collection each fixed collection section lists. Fixed in code:
 * the Hizmetler slot always lists services, Projeler always lists projects. */
export const COLLECTION_SOURCE_BY_SECTION: Partial<Record<HomeSectionKey, HomeCollectionSource>> = {
  services: "services",
  projects: "projects",
  team: "team",
  blog: "posts",
};

const COLLECTION_COPY: Partial<
  Record<HomeSectionKey, Readonly<{ allButton?: string; allHref?: string; itemCta?: string; recordsLabel: string }>>
> = {
  services: {
    allButton: "Tüm hizmetler butonu",
    allHref: "Tüm hizmetler bağlantısı",
    itemCta: "Kart butonu yazısı",
    recordsLabel: "Hizmet kayıtları",
  },
  projects: {
    allButton: "Tüm projeler butonu",
    allHref: "Tüm projeler bağlantısı",
    recordsLabel: "Proje kayıtları",
  },
  team: {
    allButton: "Tüm ekip butonu",
    allHref: "Tüm ekip bağlantısı",
    recordsLabel: "Kurul üyeleri",
  },
  blog: {
    itemCta: "Kart butonu yazısı",
    recordsLabel: "Blog yazıları",
  },
};

function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className={fieldLabel}>
      {label}
      <input
        className={fieldInput}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        maxLength={500}
      />
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className={fieldLabel}>
      {label}
      <textarea
        className={fieldInput}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={4}
        maxLength={2000}
      />
    </label>
  );
}

function SectionHeadingFields({
  config,
  update,
}: {
  config: HomeWidgetConfig;
  update: (patch: Partial<HomeWidgetConfig>) => void;
}) {
  return (
    <FieldGrid>
      <TextField label="Üst başlık" value={config.subtitle ?? ""} onChange={(subtitle) => update({ subtitle })} />
      <TextField label="Başlık" value={config.title ?? ""} onChange={(title) => update({ title })} />
    </FieldGrid>
  );
}

export function HomeSectionFieldsEditor({
  sectionKey,
  locale,
  config,
  mediaAssetsById,
  brandName,
  onChange,
}: {
  sectionKey: HomeSectionKey;
  locale: ContentLocale;
  config: HomeWidgetConfig;
  mediaAssetsById: Readonly<Record<string, MediaAssetPreview>>;
  brandName: string;
  onChange: (config: HomeWidgetConfig) => void;
}) {
  const update = (patch: Partial<HomeWidgetConfig>) => onChange({ ...config, ...patch });
  // Media placeholders quote the section's own content: the brand alone for
  // alt text, brand plus the section heading for the caption. Headings are
  // rich text, so tags are stripped before they become a suggestion.
  const headingText = (config.title ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  const mediaAlt = brandName;
  const mediaCaption = headingText ? `${brandName} ${headingText}` : brandName;
  // A just-uploaded asset is not in the server-rendered preview map yet, so
  // its URL is remembered here to keep the thumbnail visible before reload.
  const [pickedUrls, setPickedUrls] = useState<Readonly<Record<string, string>>>({});
  const urlFor = (assetId: string | null | undefined, fallback = ""): string => {
    if (!assetId) return fallback;
    return pickedUrls[assetId] ?? mediaAssetsById[assetId]?.url ?? "";
  };
  const remember = (next: { url: string; assetId?: string }) => {
    if (next.assetId && next.url) setPickedUrls((current) => ({ ...current, [next.assetId!]: next.url }));
  };

  const source = COLLECTION_SOURCE_BY_SECTION[sectionKey];
  const [records, setRecords] = useState<readonly SelectableCollectionItem[]>([]);
  const [categories, setCategories] = useState<readonly string[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!source) return;
    let cancelled = false;
    // Deferred: a synchronous setState inside an effect would cascade renders.
    const frame = requestAnimationFrame(() => {
      if (!cancelled) setLoadingRecords(true);
    });
    getCollectionSelectableItemsAction(source, locale)
      .then((result) => {
        if (cancelled) return;
        setRecords(result.items);
        setCategories(result.categories);
      })
      .finally(() => {
        if (!cancelled) setLoadingRecords(false);
      });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [source, locale]);

  const visibleRecords = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("tr");
    if (!needle) return records;
    return records.filter((record) => record.title.toLocaleLowerCase("tr").includes(needle));
  }, [records, query]);

  if (sectionKey === "hero") {
    return (
      <div className="space-y-5">
        <LazyEditorBoundary fallback="Ana başlık düzenleyicisi yükleniyor…">
          <RichTextEditor
            label="Ana başlık"
            value={config.title ?? ""}
            onChange={(title) => update({ title })}
            maxLength={300}
            required
          />
        </LazyEditorBoundary>
        <LazyEditorBoundary fallback="Açıklama düzenleyicisi yükleniyor…">
          <RichTextEditor
            label="Açıklama"
            value={config.description ?? ""}
            onChange={(description) => update({ description })}
            maxLength={2000}
            required
          />
        </LazyEditorBoundary>
        <MediaField
          label="Hero arka plan görseli"
          contextLabel={mediaAlt}
          contextDescription={mediaCaption}
          value={urlFor(config.bgImageAssetId, config.bgImage ?? DUMMY_HERO_IMAGE)}
          assetId={config.bgImageAssetId ?? undefined}
          activeLocale={locale}
          onChange={(next) => {
            remember(next);
            update({ bgImage: null, bgImageAssetId: next.assetId ?? null });
          }}
        />
        <FieldGrid>
          <TextField label="Birincil buton yazısı" value={config.primaryCtaLabel ?? ""} onChange={(primaryCtaLabel) => update({ primaryCtaLabel })} />
          <TextField label="Birincil buton bağlantısı" value={config.primaryCtaHref ?? ""} onChange={(primaryCtaHref) => update({ primaryCtaHref })} placeholder="/iletisim veya #about" />
          <TextField label="İkincil buton yazısı" value={config.secondaryCtaLabel ?? ""} onChange={(secondaryCtaLabel) => update({ secondaryCtaLabel })} />
          <TextField label="İkincil buton bağlantısı" value={config.secondaryCtaHref ?? ""} onChange={(secondaryCtaHref) => update({ secondaryCtaHref })} placeholder="/servisler veya #contact" />
        </FieldGrid>
      </div>
    );
  }

  if (sectionKey === "about") {
    const checklist = config.checklist ?? [];
    return (
      <div className="space-y-5">
        <SectionHeadingFields config={config} update={update} />
        <TextArea label="Açıklama" value={config.description ?? ""} onChange={(description) => update({ description })} />
        <MediaField
          label="Hakkımızda görseli"
          contextLabel={mediaAlt}
          contextDescription={mediaCaption}
          value={urlFor(config.bgImageAssetId, config.bgImage ?? DUMMY_ABOUT_IMAGE)}
          assetId={config.bgImageAssetId ?? undefined}
          activeLocale={locale}
          onChange={(next) => {
            remember(next);
            update({ bgImage: null, bgImageAssetId: next.assetId ?? null });
          }}
        />
        <TextField label="Görsel alternatif metni" value={config.imageAlt ?? ""} onChange={(imageAlt) => update({ imageAlt })} />
        <FieldGrid>
          {checklist.map((item, index) => (
            <TextField
              key={index}
              label={`${index + 1}. kontrol maddesi`}
              value={item}
              onChange={(value) => update({ checklist: checklist.map((current, itemIndex) => (itemIndex === index ? value : current)) })}
            />
          ))}
          <TextField label="İstatistik değeri" value={config.statValue ?? ""} onChange={(statValue) => update({ statValue })} />
          <TextField label="İstatistik etiketi" value={config.statLabel ?? ""} onChange={(statLabel) => update({ statLabel })} />
          <TextField label="Buton yazısı" value={config.primaryCtaLabel ?? ""} onChange={(primaryCtaLabel) => update({ primaryCtaLabel })} />
          <TextField label="Buton bağlantısı" value={config.primaryCtaHref ?? ""} onChange={(primaryCtaHref) => update({ primaryCtaHref })} />
          <TextField label="Telefon üst etiketi" value={config.phoneLabel ?? ""} onChange={(phoneLabel) => update({ phoneLabel })} />
          <TextField label="Telefon numarası" value={config.phoneNumber ?? ""} onChange={(phoneNumber) => update({ phoneNumber })} />
          <TextField label="Telefon bağlantısı" value={config.phoneHref ?? ""} onChange={(phoneHref) => update({ phoneHref })} placeholder="tel:+90..." />
        </FieldGrid>
      </div>
    );
  }

  if (sectionKey === "brandTrust") {
    const logos = config.logoItems ?? [];
    return (
      <div className="space-y-5">
        <TextField label="Bölüm başlığı" value={config.title ?? ""} onChange={(title) => update({ title })} />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {logos.map((logo, index) => (
            <div key={index} className="relative space-y-3 border border-brand-border bg-brand-page p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-brand-muted">{index + 1}. logo</span>
                <button
                  type="button"
                  onClick={() => update({ logoItems: logos.filter((_, itemIndex) => itemIndex !== index) })}
                  className="text-xs font-semibold text-brand-danger hover:underline"
                >
                  Kaldır
                </button>
              </div>
              <MediaField
                label="Logo görseli"
                contextLabel={mediaAlt}
                contextDescription={`${mediaAlt} - ${index + 1}. marka logosu`}
                value={urlFor(logo.assetId, "")}
                assetId={logo.assetId ?? undefined}
                activeLocale={locale}
                onChange={(next) => {
                  remember(next);
                  update({ logoItems: logos.map((item, itemIndex) => (itemIndex === index ? { ...item, assetId: next.assetId ?? null } : item)) });
                }}
              />
              <TextField
                label="Alternatif metin"
                value={logo.altText}
                onChange={(altText) => update({ logoItems: logos.map((item, itemIndex) => (itemIndex === index ? { ...item, altText } : item)) })}
              />
              <div className="space-y-1">
                <span className={fieldLabel}>Logo arka plan rengi</span>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={logo.bgColor || "#ffffff"}
                    onChange={(event) =>
                      update({
                        logoItems: logos.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, bgColor: event.target.value } : item,
                        ),
                      })
                    }
                    className="h-9 w-12 cursor-pointer rounded-[var(--radius-sm)] border border-brand-border bg-brand-surface p-1"
                    aria-label={`${index + 1}. logo arka plan rengi`}
                  />
                  <input
                    type="text"
                    value={logo.bgColor ?? ""}
                    onChange={(event) =>
                      update({
                        logoItems: logos.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, bgColor: event.target.value.trim() } : item,
                        ),
                      })
                    }
                    placeholder="#000000 (boş = renksiz)"
                    maxLength={7}
                    className={fieldInput}
                  />
                  {logo.bgColor ? (
                    <button
                      type="button"
                      onClick={() =>
                        update({
                          logoItems: logos.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, bgColor: "" } : item,
                          ),
                        })
                      }
                      className="shrink-0 text-xs font-semibold text-brand-muted hover:text-brand-text"
                    >
                      Temizle
                    </button>
                  ) : null}
                </div>
                <p className={fieldHint}>Kare kutu bu renkte olur; boş bırakılırsa logo arka plansız görünür.</p>
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => update({ logoItems: [...logos, { assetId: null, altText: mediaAlt, bgColor: "" }] })}
          className="rounded-[var(--radius-sm)] border border-brand-border bg-brand-surface px-4 py-2 text-xs font-bold text-brand-text transition hover:bg-brand-page"
        >
          + Logo ekle
        </button>
      </div>
    );
  }

  if (sectionKey === "process") {
    const items = config.processItems ?? [];
    return (
      <div className="space-y-5">
        <SectionHeadingFields config={config} update={update} />
        <div className="grid gap-4 md:grid-cols-2">
          {items.map((item, index) => (
            <div key={index} className="space-y-3 border border-brand-border bg-brand-page p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-brand-muted">{index + 1}. süreç adımı</p>
              <MediaField
                label="İkon (SVG veya PNG)"
                contextLabel={item.title.trim() || mediaAlt}
                contextDescription={item.title.trim() ? `${mediaAlt} ${item.title.trim()}` : mediaCaption}
                value={urlFor(item.iconAssetId, "")}
                assetId={item.iconAssetId ?? undefined}
                activeLocale={locale}
                onChange={(next) => {
                  remember(next);
                  update({ processItems: items.map((current, itemIndex) => (itemIndex === index ? { ...current, iconAssetId: next.assetId ?? null } : current)) });
                }}
              />
              <TextField label="Adım başlığı" value={item.title} onChange={(title) => update({ processItems: items.map((current, itemIndex) => (itemIndex === index ? { ...current, title } : current)) })} />
              <TextArea label="Adım açıklaması" value={item.text} onChange={(text) => update({ processItems: items.map((current, itemIndex) => (itemIndex === index ? { ...current, text } : current)) })} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (sectionKey === "achievements") {
    const items = config.kpiItems ?? [];
    return (
      <div className="space-y-5">
        <SectionHeadingFields config={config} update={update} />
        <div className="grid gap-4 md:grid-cols-2">
          {items.map((item, index) => (
            <div key={index} className="space-y-3 border border-brand-border bg-brand-page p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-brand-muted">{index + 1}. KPI</p>
              <MediaField
                label="İkon (SVG veya PNG)"
                contextLabel={item.label.trim() || mediaAlt}
                contextDescription={item.label.trim() ? `${mediaAlt} ${item.label.trim()}` : mediaCaption}
                value={urlFor(item.iconAssetId, "")}
                assetId={item.iconAssetId ?? undefined}
                activeLocale={locale}
                onChange={(next) => {
                  remember(next);
                  update({ kpiItems: items.map((current, itemIndex) => (itemIndex === index ? { ...current, iconAssetId: next.assetId ?? null } : current)) });
                }}
              />
              <FieldGrid>
                <TextField label="Değer" value={item.value} onChange={(value) => update({ kpiItems: items.map((current, itemIndex) => (itemIndex === index ? { ...current, value } : current)) })} />
                <TextField label="Etiket" value={item.label} onChange={(label) => update({ kpiItems: items.map((current, itemIndex) => (itemIndex === index ? { ...current, label } : current)) })} />
              </FieldGrid>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (sectionKey === "testimonials") {
    const items = config.testimonialItems ?? [];
    return (
      <div className="space-y-5">
        <SectionHeadingFields config={config} update={update} />
        <div className="grid gap-4 md:grid-cols-2">
          {items.map((item, index) => (
            <div key={index} className="space-y-3 border border-brand-border bg-brand-page p-4">
              <MediaField
                label={`${index + 1}. kişi görseli`}
                contextLabel={item.name.trim() || mediaAlt}
                contextDescription={item.name.trim() ? `${item.name.trim()} - ${item.role.trim() || mediaAlt}` : mediaCaption}
                value={urlFor(item.avatarAssetId, dummyImage(DUMMY_AVATAR_IMAGES, index))}
                assetId={item.avatarAssetId ?? undefined}
                activeLocale={locale}
                onChange={(next) => {
                  remember(next);
                  update({ testimonialItems: items.map((current, itemIndex) => (itemIndex === index ? { ...current, avatarAssetId: next.assetId ?? null } : current)) });
                }}
              />
              <FieldGrid>
                <TextField label="Ad soyad" value={item.name} onChange={(name) => update({ testimonialItems: items.map((current, itemIndex) => (itemIndex === index ? { ...current, name } : current)) })} />
                <TextField label="Görev / unvan" value={item.role} onChange={(role) => update({ testimonialItems: items.map((current, itemIndex) => (itemIndex === index ? { ...current, role } : current)) })} />
              </FieldGrid>
              <TextArea label="Referans metni" value={item.quote} onChange={(quote) => update({ testimonialItems: items.map((current, itemIndex) => (itemIndex === index ? { ...current, quote } : current)) })} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (sectionKey === "marquee") {
    const items = config.marqueeItems ?? [];
    return (
      <div className="space-y-4">
        <FieldGrid>
          {items.map((item, index) => (
            <div key={index} className="flex items-end gap-2">
              <div className="flex-1">
                <TextField
                  label={`${index + 1}. kayan yazı`}
                  value={item}
                  onChange={(value) =>
                    update({ marqueeItems: items.map((current, itemIndex) => (itemIndex === index ? value : current)) })
                  }
                />
              </div>
              <button
                type="button"
                onClick={() => update({ marqueeItems: items.filter((_, itemIndex) => itemIndex !== index) })}
                className="mb-1 shrink-0 text-xs font-semibold text-brand-danger hover:underline"
              >
                Kaldır
              </button>
            </div>
          ))}
        </FieldGrid>
        <button
          type="button"
          onClick={() => update({ marqueeItems: [...items, ""] })}
          className="rounded-[var(--radius-sm)] border border-brand-border bg-brand-surface px-4 py-2 text-xs font-bold text-brand-text transition hover:bg-brand-page"
        >
          + Kayan yazı ekle
        </button>
      </div>
    );
  }

  const copy = COLLECTION_COPY[sectionKey];
  const selectionMode = config.selectionMode ?? "latest";
  const selectedIds = config.selectedEntityIds ?? [];
  const selectedCategories = config.categories ?? [];
  // Mirrors the renderer's own per-section fallback so the shown value is
  // what the page actually renders before the admin ever changes it.
  const naturalCount = sectionKey === "projects" || sectionKey === "blog" ? 3 : 4;
  const columns = config.columns ?? (String(naturalCount) as "2" | "3" | "4");
  const limit = config.limit ?? naturalCount;

  return (
    <div className="space-y-5">
      <SectionHeadingFields config={config} update={update} />

      <FieldGrid>
        <label className={fieldLabel}>
          Satırdaki kart sayısı (grid)
          <select className={fieldInput} value={columns} onChange={(event) => update({ columns: event.target.value as "2" | "3" | "4" })}>
            <option value="2">2 kart</option>
            <option value="3">3 kart</option>
            <option value="4">4 kart</option>
          </select>
        </label>
        <label className={fieldLabel}>
          Gösterilecek kayıt adedi
          <input
            className={fieldInput}
            type="number"
            min={1}
            max={20}
            value={limit}
            onChange={(event) => {
              const next = Number(event.target.value);
              if (Number.isFinite(next)) update({ limit: Math.min(20, Math.max(1, Math.trunc(next))) });
            }}
          />
        </label>
        <label className={fieldLabel}>
          Kayıt seçimi
          <select
            className={fieldInput}
            value={selectionMode}
            onChange={(event) => update({ selectionMode: event.target.value as "latest" | "manual" | "category" })}
          >
            <option value="latest">En yeniler (otomatik)</option>
            <option value="manual">Elle seçtiklerim</option>
            <option value="category">Belirli kategori / etiket</option>
          </select>
          <span className={fieldHint}>Kart içerikleri {copy?.recordsLabel.toLocaleLowerCase("tr")} tablosundan gelir.</span>
        </label>
      </FieldGrid>

      {selectionMode === "manual" ? (
        <div className="space-y-3 border border-brand-border bg-brand-page p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs font-bold uppercase tracking-wider text-brand-muted">
              {copy?.recordsLabel} ({selectedIds.length} seçili)
            </p>
            <input
              className={`${fieldInput} max-w-xs`}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Kayıt ara"
            />
          </div>
          {loadingRecords ? <p className="text-xs text-brand-muted">Kayıtlar yükleniyor…</p> : null}
          <div className="max-h-72 space-y-1 overflow-y-auto">
            {visibleRecords.map((record) => {
              const checked = selectedIds.includes(record.id);
              return (
                <label key={record.id} className="flex items-center gap-2 border border-brand-border bg-brand-surface px-3 py-2 text-sm text-brand-text">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() =>
                      update({
                        selectedEntityIds: checked
                          ? selectedIds.filter((id) => id !== record.id)
                          : [...selectedIds, record.id],
                      })
                    }
                  />
                  <span className="flex-1 truncate">{record.title}</span>
                  {record.category ? (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-brand-muted">{record.category}</span>
                  ) : null}
                </label>
              );
            })}
            {!loadingRecords && visibleRecords.length === 0 ? (
              <p className="text-xs text-brand-muted">Kayıt bulunamadı.</p>
            ) : null}
          </div>
          <p className="text-[11px] text-brand-muted">Seçim sırası anasayfadaki kart sırasıdır.</p>
        </div>
      ) : null}

      {selectionMode === "category" ? (
        <div className="space-y-3 border border-brand-border bg-brand-page p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-brand-muted">Kategori / etiket</p>
          {categories.length === 0 ? (
            <p className="text-xs text-brand-muted">
              {loadingRecords ? "Kategoriler yükleniyor…" : "Bu koleksiyonda kategori tanımlı kayıt yok."}
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => {
                const checked = selectedCategories.includes(category);
                return (
                  <button
                    key={category}
                    type="button"
                    onClick={() =>
                      update({
                        categories: checked
                          ? selectedCategories.filter((item) => item !== category)
                          : [...selectedCategories, category],
                      })
                    }
                    className={`rounded-[var(--radius-sm)] border px-3 py-1.5 text-xs font-semibold ${
                      checked
                        ? "border-brand-primary bg-brand-primary text-brand-on-invert"
                        : "border-brand-border bg-brand-surface text-brand-text"
                    }`}
                  >
                    {category}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ) : null}

      {copy?.allButton ? (
        <FieldGrid>
          <TextField label={copy.allButton} value={config.primaryCtaLabel ?? ""} onChange={(primaryCtaLabel) => update({ primaryCtaLabel })} />
          <TextField label={copy.allHref ?? "Buton bağlantısı"} value={config.primaryCtaHref ?? ""} onChange={(primaryCtaHref) => update({ primaryCtaHref })} />
        </FieldGrid>
      ) : null}
      {copy?.itemCta ? (
        <TextField label={copy.itemCta} value={config.itemCtaLabel ?? ""} onChange={(itemCtaLabel) => update({ itemCtaLabel })} />
      ) : null}
      <p className="text-xs leading-5 text-brand-muted">
        Kartların başlık, açıklama, görsel, ikon ve bağlantıları kayıtların kendi editöründen düzenlenir.
      </p>
    </div>
  );
}
