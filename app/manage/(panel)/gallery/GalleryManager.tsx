"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, ImagePlus, Save, Trash2 } from "lucide-react";
import { MediaPickerModal } from "@/components/admin/MediaPickerModal";
import { SortableDragHandleIcon, SortableList } from "@/components/admin/SortableList";
import { EmptyState } from "@/components/admin/StateSurfaces";
import { useToast } from "@/components/admin/Toast";
import { card, cn, fieldInput, iconButton, primaryButton, secondaryButton } from "@/components/admin/ui";
import type { AdminGalleryRow } from "@/lib/kadik-content/collections";
import type { MediaSelectPayload } from "@/lib/media/types";
import { saveGalleryAction } from "../kadik-collection-actions";

type Item = Readonly<{ key: string; id: string | null; imageAssetId: string | null; imageUrl: string; category: string; caption: string; published: boolean }>;

let counter = 0;
const toItems = (rows: readonly AdminGalleryRow[]): Item[] => rows.map((row) => ({ key: row.id, ...row }));

/**
 * The whole gallery on one screen: a sortable photo grid where each card
 * carries its own category, caption and visibility. Photos are picked from
 * the media library (several at once); saving replaces the gallery in one go.
 */
export function GalleryManager({ items: rows }: { items: readonly AdminGalleryRow[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [items, setItems] = useState<Item[]>(() => toItems(rows));
  const [baseline, setBaseline] = useState(() => JSON.stringify(toItems(rows)));
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const dirty = useMemo(() => JSON.stringify(items) !== baseline, [items, baseline]);
  const categories = useMemo(() => [...new Set(items.map((item) => item.category.trim()).filter(Boolean))], [items]);
  const missingCategory = items.filter((item) => !item.category.trim()).length;

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const update = (key: string, patch: Partial<Item>) => setItems((current) => current.map((item) => (item.key === key ? { ...item, ...patch } : item)));

  const add = (picked: readonly MediaSelectPayload[]) => {
    const defaultCategory = categories[0] ?? "";
    setItems((current) => [
      ...current,
      ...picked.map((asset) => ({
        key: `new-${Date.now().toString(36)}-${counter++}`,
        id: null,
        imageAssetId: asset.assetId,
        imageUrl: asset.url,
        category: defaultCategory,
        caption: asset.altText ?? asset.caption ?? "",
        published: true,
      })),
    ]);
    setPickerOpen(false);
  };

  const save = () =>
    startTransition(async () => {
      const result = await saveGalleryAction(
        items.map(({ id, imageAssetId, imageUrl, category, caption, published }) => ({ id, imageAssetId, imageUrl, category, caption, published })),
      );
      toast(result.message, result.ok ? "success" : "error");
      if (result.ok) {
        setBaseline(JSON.stringify(items));
        router.refresh();
      }
    });

  return (
    <div className="space-y-4">
      <div className={cn(card, "sticky top-[57px] z-10 flex flex-wrap items-center justify-between gap-3 px-4 py-3")}>
        <p className="text-xs text-brand-muted">
          {items.length} fotoğraf · {categories.length} kategori
          {missingCategory ? <span className="ml-2 font-bold text-brand-warning">{missingCategory} fotoğrafın kategorisi yok</span> : null}
          {dirty ? <span className="ml-2 font-bold text-brand-warning">Kaydedilmemiş değişiklik var</span> : null}
        </p>
        <div className="flex flex-wrap gap-2">
          <a href="/gallery" target="_blank" rel="noopener noreferrer" className={secondaryButton}>
            <Eye className="size-3.5" aria-hidden="true" />
            Sitede gör
          </a>
          <button type="button" className={secondaryButton} onClick={() => setPickerOpen(true)}>
            <ImagePlus className="size-3.5" aria-hidden="true" />
            Fotoğraf ekle
          </button>
          <button type="button" className={primaryButton} onClick={save} disabled={pending || !dirty}>
            <Save className="size-3.5" aria-hidden="true" />
            {pending ? "Kaydediliyor…" : "Kaydet"}
          </button>
        </div>
      </div>

      <datalist id="gallery-categories">
        {categories.map((category) => (
          <option key={category} value={category} />
        ))}
      </datalist>

      {items.length === 0 ? (
        <EmptyState title="Galeri boş" description="“Fotoğraf ekle” ile medya kütüphanesinden bir ya da birden fazla fotoğraf seçin." />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <SortableList
            strategy="grid"
            items={items.map((item) => ({ ...item, id: item.key, recordId: item.id }))}
            onReorder={(keys) => setItems((current) => keys.flatMap((key) => current.filter((item) => item.key === key)))}
            renderItem={(item, { setNodeRef, style, dragHandleProps }) => (
              <div ref={setNodeRef} style={style} className={cn(card, "overflow-hidden", !item.published && "opacity-60")}>
                <div className="relative bg-brand-page">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.imageUrl} alt={item.caption} className="aspect-[4/3] w-full object-cover" />
                  <div className="absolute left-2 top-2 rounded-[var(--radius-sm)] bg-brand-surface/90">
                    <button type="button" {...dragHandleProps}>
                      <SortableDragHandleIcon />
                    </button>
                  </div>
                  <div className="absolute right-2 top-2 flex gap-1 rounded-[var(--radius-sm)] bg-brand-surface/90">
                    <button
                      type="button"
                      className={iconButton}
                      onClick={() => update(item.key, { published: !item.published })}
                      aria-label={item.published ? "Sitede gizle" : "Sitede göster"}
                      title={item.published ? "Sitede gizle" : "Sitede göster"}
                    >
                      {item.published ? <Eye className="size-4" aria-hidden="true" /> : <EyeOff className="size-4" aria-hidden="true" />}
                    </button>
                    <button
                      type="button"
                      className={cn(iconButton, "hover:text-brand-danger")}
                      onClick={() => setItems((current) => current.filter((candidate) => candidate.key !== item.key))}
                      aria-label="Galeriden çıkar"
                      title="Galeriden çıkar (medya kütüphanesinden silinmez)"
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
                <div className="space-y-2 p-3">
                  <input
                    className={cn(fieldInput, "mt-0")}
                    list="gallery-categories"
                    placeholder="Kategori (ör. Events)"
                    aria-label="Kategori"
                    value={item.category}
                    onChange={(e) => update(item.key, { category: e.target.value })}
                  />
                  <input
                    className={cn(fieldInput, "mt-0")}
                    placeholder="Açıklama (görme engelliler ve Google için)"
                    aria-label="Açıklama"
                    value={item.caption}
                    onChange={(e) => update(item.key, { caption: e.target.value })}
                  />
                </div>
              </div>
            )}
          />
        </div>
      )}

      <MediaPickerModal open={pickerOpen} onClose={() => setPickerOpen(false)} multiple onSelectMultiple={add} allowedKinds={["image"]} contextLabel="Galeri" />
    </div>
  );
}
