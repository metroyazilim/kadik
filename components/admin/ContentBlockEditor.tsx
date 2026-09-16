"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type {
  BannerContentBlock,
  ContentBlock,
  ContentBlockType,
  ImageContentBlock,
  KpiContentBlock,
  QuoteContentBlock,
  TextContentBlock,
} from "@/lib/content-model/content-blocks";
import type { MediaAssetPreview } from "@/lib/content-model/content-media";
import { fieldHint, fieldInput, fieldLabel } from "./ui";
import { MediaField } from "./MediaField";
import { RichTextEditor } from "./RichTextEditor";
import { SortableDragHandleIcon, SortableList } from "./SortableList";

const BLOCK_TYPE_LABEL: Record<ContentBlockType, string> = {
  text: "Metin",
  image: "Görsel",
  kpi: "KPI",
  banner: "Banner",
  quote: "Alıntı",
};

function newBlock(type: ContentBlockType): ContentBlock {
  const id = crypto.randomUUID();
  switch (type) {
    case "text":
      return { id, type: "text", html: "" };
    case "image":
      return { id, type: "image", assetId: "", caption: null };
    case "kpi":
      return { id, type: "kpi", heading: null, items: [{ label: "", value: "" }] };
    case "banner":
      return { id, type: "banner", heading: "", text: "", imageAssetId: null, ctaLabel: null, ctaUrl: null };
    case "quote":
      return { id, type: "quote", text: "", author: null };
  }
}

export type ContentBlockEditorProps = Readonly<{
  name: string;
  label: string;
  defaultValue: readonly ContentBlock[];
  /** Resolved `MediaAsset` previews for every IMAGE/BANNER block already referenced, keyed by asset id - hydrated server-side by the caller's edit-view loader. */
  assetPreviews?: Readonly<Record<string, MediaAssetPreview>>;
  maxBlocks?: number;
  required?: boolean;
  onDirty?: () => void;
}>;

/**
 * The typed content-block editor every long-form field (Service/Product
 * body, Project challenge/solution, Blog body) uses instead of one flat
 * rich-text field. Owns its own block array as internal state and submits
 * it as one JSON `<input type="hidden" name={name}>` - the server action
 * `JSON.parse`s it and runs it through `validateContentBlocks` exactly like
 * every other field goes through its own validator. Reordering is
 * `SortableList` (dnd-kit) - there is no numeric position field at the
 * block level, matching FR-15's collection-level reorder contract.
 */
export function ContentBlockEditor({
  name,
  label,
  defaultValue,
  assetPreviews = {},
  maxBlocks = 40,
  required = true,
  onDirty,
}: ContentBlockEditorProps) {
  const [blocks, setBlocks] = useState<readonly ContentBlock[]>(defaultValue);

  const commit = (next: readonly ContentBlock[]) => {
    setBlocks(next);
    onDirty?.();
  };

  const addBlock = (type: ContentBlockType) => {
    if (blocks.length >= maxBlocks) return;
    commit([...blocks, newBlock(type)]);
  };

  const removeBlock = (id: string) => {
    commit(blocks.filter((block) => block.id !== id));
  };

  const updateBlock = (id: string, next: ContentBlock) => {
    commit(blocks.map((block) => (block.id === id ? next : block)));
  };

  const handleReorder = (nextOrderedIds: readonly string[]) => {
    const byId = new Map(blocks.map((block) => [block.id, block]));
    commit(nextOrderedIds.map((id) => byId.get(id)).filter((block): block is ContentBlock => Boolean(block)));
  };

  return (
    <div className="space-y-3">
      <input type="hidden" name={name} value={JSON.stringify(blocks)} />
      <div className="flex items-center justify-between">
        <span className={fieldLabel}>{label}</span>
        <span className="text-xs text-brand-muted">
          {blocks.length} / {maxBlocks} blok
        </span>
      </div>

      {blocks.length === 0 ? (
        <p className={`${fieldHint} rounded-lg border border-dashed border-brand-border bg-brand-page p-4 text-center`}>
          {required ? "En az bir blok ekleyin." : "Henüz blok eklenmedi."}
        </p>
      ) : (
        <div className="space-y-3">
          <SortableList
            items={blocks}
            onReorder={handleReorder}
            renderItem={(block, row) => (
              <div
                ref={row.setNodeRef as (node: HTMLDivElement | null) => void}
                style={row.style}
                className="rounded-lg border border-brand-border bg-brand-surface p-4"
              >
                <div className="mb-3 flex items-center justify-between border-b border-brand-border pb-2">
                  <div className="flex items-center gap-2">
                    <button type="button" {...row.dragHandleProps}>
                      <SortableDragHandleIcon />
                    </button>
                    <span className="rounded-full bg-brand-page px-2.5 py-1 text-xs font-semibold text-brand-text">
                      {BLOCK_TYPE_LABEL[block.type]}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeBlock(block.id)}
                    className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-brand-danger hover:bg-brand-danger/10"
                    aria-label={`${BLOCK_TYPE_LABEL[block.type]} bloğunu sil`}
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    Sil
                  </button>
                </div>
                <BlockFields block={block} assetPreviews={assetPreviews} onChange={(next) => updateBlock(block.id, next)} />
              </div>
            )}
          />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-brand-border pt-3">
        {(Object.keys(BLOCK_TYPE_LABEL) as ContentBlockType[]).map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => addBlock(type)}
            disabled={blocks.length >= maxBlocks}
            className="flex items-center gap-1.5 rounded-lg border border-brand-border bg-brand-page px-3 py-1.5 text-xs font-medium text-brand-text transition hover:bg-brand-primary/10 hover:text-brand-primary disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            {BLOCK_TYPE_LABEL[type]} ekle
          </button>
        ))}
      </div>
    </div>
  );
}

function BlockFields({
  block,
  assetPreviews,
  onChange,
}: {
  block: ContentBlock;
  assetPreviews: Readonly<Record<string, MediaAssetPreview>>;
  onChange: (next: ContentBlock) => void;
}) {
  switch (block.type) {
    case "text":
      return <TextBlockFields block={block} onChange={onChange} />;
    case "image":
      return <ImageBlockFields block={block} assetPreviews={assetPreviews} onChange={onChange} />;
    case "kpi":
      return <KpiBlockFields block={block} onChange={onChange} />;
    case "banner":
      return <BannerBlockFields block={block} assetPreviews={assetPreviews} onChange={onChange} />;
    case "quote":
      return <QuoteBlockFields block={block} onChange={onChange} />;
  }
}

function TextBlockFields({ block, onChange }: { block: TextContentBlock; onChange: (next: ContentBlock) => void }) {
  return (
    <RichTextEditor
      label="Metin"
      value={block.html}
      onChange={(html) => onChange({ ...block, html })}
      maxLength={20000}
    />
  );
}

function ImageBlockFields({
  block,
  assetPreviews,
  onChange,
}: {
  block: ImageContentBlock;
  assetPreviews: Readonly<Record<string, MediaAssetPreview>>;
  onChange: (next: ContentBlock) => void;
}) {
  const preview = block.assetId ? assetPreviews[block.assetId] : undefined;
  return (
    <div className="space-y-3">
      <MediaField
        label="Görsel"
        value={preview?.url ?? ""}
        assetId={block.assetId || undefined}
        onChange={(payload) => onChange({ ...block, assetId: payload.assetId ?? "" })}
      />
      <label className={fieldLabel}>
        Alt yazı (opsiyonel)
        <input
          className={fieldInput}
          value={block.caption ?? ""}
          maxLength={300}
          onChange={(e) => onChange({ ...block, caption: e.target.value.length > 0 ? e.target.value : null })}
        />
      </label>
    </div>
  );
}

function KpiBlockFields({ block, onChange }: { block: KpiContentBlock; onChange: (next: ContentBlock) => void }) {
  const updateItem = (index: number, patch: Partial<{ label: string; value: string }>) => {
    const items = block.items.map((item, i) => (i === index ? { ...item, ...patch } : item));
    onChange({ ...block, items });
  };
  const removeItem = (index: number) => {
    if (block.items.length <= 1) return;
    onChange({ ...block, items: block.items.filter((_, i) => i !== index) });
  };
  const addItem = () => {
    if (block.items.length >= 8) return;
    onChange({ ...block, items: [...block.items, { label: "", value: "" }] });
  };

  return (
    <div className="space-y-3">
      <label className={fieldLabel}>
        Başlık (opsiyonel)
        <input
          className={fieldInput}
          value={block.heading ?? ""}
          maxLength={120}
          onChange={(e) => onChange({ ...block, heading: e.target.value.length > 0 ? e.target.value : null })}
        />
      </label>
      <div className="space-y-2">
        {block.items.map((item, index) => (
          <div key={index} className="flex items-center gap-2">
            <input
              className={fieldInput}
              placeholder="Değer (örn. 250+)"
              value={item.value}
              maxLength={40}
              onChange={(e) => updateItem(index, { value: e.target.value })}
            />
            <input
              className={fieldInput}
              placeholder="Etiket (örn. Tamamlanan proje)"
              value={item.label}
              maxLength={60}
              onChange={(e) => updateItem(index, { label: e.target.value })}
            />
            <button
              type="button"
              onClick={() => removeItem(index)}
              disabled={block.items.length <= 1}
              className="shrink-0 rounded-lg p-2 text-brand-danger hover:bg-brand-danger/10 disabled:opacity-40"
              aria-label="KPI öğesini sil"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={addItem}
        disabled={block.items.length >= 8}
        className="flex items-center gap-1.5 text-xs font-medium text-brand-primary hover:underline disabled:opacity-50"
      >
        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
        KPI öğesi ekle
      </button>
    </div>
  );
}

function BannerBlockFields({
  block,
  assetPreviews,
  onChange,
}: {
  block: BannerContentBlock;
  assetPreviews: Readonly<Record<string, MediaAssetPreview>>;
  onChange: (next: ContentBlock) => void;
}) {
  const preview = block.imageAssetId ? assetPreviews[block.imageAssetId] : undefined;
  return (
    <div className="space-y-3">
      <label className={fieldLabel}>
        Başlık
        <input
          className={fieldInput}
          value={block.heading}
          maxLength={120}
          required
          onChange={(e) => onChange({ ...block, heading: e.target.value })}
        />
      </label>
      <label className={fieldLabel}>
        Metin
        <textarea
          className={`${fieldInput} resize-y`}
          rows={3}
          value={block.text}
          maxLength={500}
          required
          onChange={(e) => onChange({ ...block, text: e.target.value })}
        />
      </label>
      <MediaField
        label="Arka plan görseli (opsiyonel)"
        value={preview?.url ?? ""}
        assetId={block.imageAssetId ?? undefined}
        onChange={(payload) => onChange({ ...block, imageAssetId: payload.assetId ?? null })}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={fieldLabel}>
          CTA metni (opsiyonel)
          <input
            className={fieldInput}
            value={block.ctaLabel ?? ""}
            maxLength={60}
            onChange={(e) => {
              const ctaLabel = e.target.value.length > 0 ? e.target.value : null;
              onChange({ ...block, ctaLabel, ctaUrl: ctaLabel ? block.ctaUrl : null });
            }}
          />
        </label>
        <label className={fieldLabel}>
          CTA bağlantısı (opsiyonel)
          <input
            className={fieldInput}
            value={block.ctaUrl ?? ""}
            placeholder="https://... veya /iletisim"
            onChange={(e) => {
              const ctaUrl = e.target.value.length > 0 ? e.target.value : null;
              onChange({ ...block, ctaUrl, ctaLabel: ctaUrl ? block.ctaLabel : null });
            }}
          />
        </label>
      </div>
    </div>
  );
}

function QuoteBlockFields({ block, onChange }: { block: QuoteContentBlock; onChange: (next: ContentBlock) => void }) {
  return (
    <div className="space-y-3">
      <label className={fieldLabel}>
        Alıntı metni
        <textarea
          className={`${fieldInput} resize-y`}
          rows={3}
          value={block.text}
          maxLength={600}
          required
          onChange={(e) => onChange({ ...block, text: e.target.value })}
        />
      </label>
      <label className={fieldLabel}>
        Kaynak (opsiyonel)
        <input
          className={fieldInput}
          value={block.author ?? ""}
          maxLength={120}
          onChange={(e) => onChange({ ...block, author: e.target.value.length > 0 ? e.target.value : null })}
        />
      </label>
    </div>
  );
}
