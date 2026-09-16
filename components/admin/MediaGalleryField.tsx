"use client";

import { useId, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { MediaKind, MediaSelectPayload } from "@/lib/media/types";
import { MediaPickerModal } from "./MediaPickerModal";
import { SortableDragHandleIcon, SortableList } from "./SortableList";

type GalleryEntry = { id: string; assetId: string; url: string };

/**
 * Multi-image field for `galleryAssetIds`-style arrays (Epic 3/4). Every
 * slot is filled through `MediaPickerModal`'s multi-select mode - never a
 * free-text URL list - and reorders by drag/keyboard through the same
 * shared `SortableList` list pages use, never a numeric position input.
 * Submits as repeated `<input type="hidden" name={name}>` entries in
 * render order, each carrying the asset's `id` (not its URL) - the server
 * action reads it with `formData.getAll(name)` and the payload validator
 * stores exactly those ids, per "never an arbitrary image URL, always a
 * MediaAsset relation".
 */
export function MediaGalleryField({
  name,
  label,
  defaultValue = [],
  description,
  contextLabel,
  allowedKinds = ["image"],
}: {
  name: string;
  label: string;
  /** Initial `{ assetId, url }` pairs, resolved server-side by the caller
   * (an id alone has no URL to preview without a round trip). */
  defaultValue?: readonly Readonly<{ assetId: string; url: string }>[];
  description?: string;
  /** Alt/caption placeholder content for the picker; defaults to `label`. */
  contextLabel?: string;
  allowedKinds?: readonly MediaKind[];
}) {
  const idBase = useId();
  const [entries, setEntries] = useState<GalleryEntry[]>(() =>
    defaultValue.map((item, index) => ({ id: `${idBase}-${index}`, assetId: item.assetId, url: item.url })),
  );
  const [pickerOpen, setPickerOpen] = useState(false);

  const handleAddMany = (payloads: readonly MediaSelectPayload[]) => {
    setEntries((prev) => {
      const existingAssetIds = new Set(prev.map((entry) => entry.assetId));
      const additions = payloads
        .filter((payload) => !existingAssetIds.has(payload.assetId))
        .map((payload, index) => ({ id: `${idBase}-${prev.length + index}-${payload.assetId}`, assetId: payload.assetId, url: payload.url }));
      return [...prev, ...additions];
    });
    setPickerOpen(false);
  };

  const handleRemove = (id: string) => {
    setEntries((prev) => prev.filter((entry) => entry.id !== id));
  };

  const handleReorder = (orderedIds: readonly string[]) => {
    const byId = new Map(entries.map((entry) => [entry.id, entry]));
    setEntries(orderedIds.map((id) => byId.get(id)).filter((entry): entry is GalleryEntry => Boolean(entry)));
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-brand-text">{label}</label>

      {entries.length > 0 ? (
        <SortableList
          items={entries}
          onReorder={handleReorder}
          strategy="grid"
          renderItem={(entry, { setNodeRef, style, isDragging, dragHandleProps }) => (
            <div
              ref={setNodeRef}
              style={style}
              className={`flex items-center gap-2 rounded-lg border border-brand-border bg-brand-page p-2 ${isDragging ? "shadow-lg" : ""}`}
            >
              <input type="hidden" name={name} value={entry.assetId} />
              <button type="button" {...dragHandleProps}>
                <SortableDragHandleIcon />
              </button>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={entry.url} alt="" className="h-12 w-16 shrink-0 rounded-md object-cover" />
              <span className="min-w-0 flex-1 truncate text-xs text-brand-muted">{entry.url}</span>
              <button
                type="button"
                onClick={() => handleRemove(entry.id)}
                className="rounded-md p-1.5 text-brand-danger hover:bg-brand-danger/10"
                aria-label="Görseli kaldır"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          )}
        />
      ) : null}

      <button
        type="button"
        onClick={() => setPickerOpen(true)}
        className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-brand-border px-3 py-2 text-xs font-medium text-brand-muted hover:border-brand-primary hover:text-brand-primary"
      >
        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
        Görsel ekle
      </button>

      {description ? <p className="text-[11px] text-brand-muted">{description}</p> : null}

      <MediaPickerModal open={pickerOpen} onClose={() => setPickerOpen(false)} multiple onSelectMultiple={handleAddMany} allowedKinds={allowedKinds} contextLabel={contextLabel ?? label} />
    </div>
  );
}
