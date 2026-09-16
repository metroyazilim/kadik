"use client";

import { useRef, useState } from "react";
import { FileText, Image as ImageIcon, RefreshCw, Trash2 } from "lucide-react";
import type { MediaFieldProps, MediaSelectPayload } from "@/lib/media/types";
import { MediaPickerModal } from "./MediaPickerModal";

/**
 * The only way any admin form sets an image (FR-14, AD-9). Never renders a
 * free-text URL input - selection or upload always goes through
 * `MediaPickerModal`, which only returns assets that already exist in (or
 * were just created in) the `MediaAsset` library. When `name` is given it
 * manages its own state and submits via a hidden input, so it drops into an
 * uncontrolled native `<form action={serverAction}>` the same way every other
 * field in these forms works.
 */
export function MediaField({
  name,
  defaultValue,
  defaultAssetId,
  value: controlledValue,
  assetId: controlledAssetId,
  onChange,
  label = "Görsel",
  description,
  contextLabel,
  contextDescription,
  contextFieldName,
  allowedKinds = ["image"],
  activeLocale,
  disabled = false,
}: MediaFieldProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [liveContext, setLiveContext] = useState<string | null>(null);
  const [internalValue, setInternalValue] = useState(controlledValue ?? defaultValue ?? "");
  const [internalAssetId, setInternalAssetId] = useState(controlledAssetId ?? defaultAssetId ?? undefined);

  // The record's title lives in an uncontrolled form input, so it is read at
  // the moment the picker opens - that is the only point its value matters.
  const openPicker = () => {
    const field = contextFieldName
      ? rootRef.current?.closest("form")?.elements.namedItem(contextFieldName)
      : null;
    const typed = field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement ? field.value.trim() : "";
    setLiveContext(typed.length > 0 ? typed : null);
    setModalOpen(true);
  };

  const value = controlledValue ?? internalValue;
  const assetId = controlledAssetId ?? internalAssetId;

  const handleSelect = (payload: MediaSelectPayload) => {
    setInternalValue(payload.url);
    setInternalAssetId(payload.assetId);
    onChange?.({ url: payload.url, assetId: payload.assetId, altText: payload.altText || undefined });
  };

  const handleRemove = () => {
    setInternalValue("");
    setInternalAssetId(undefined);
    onChange?.({ url: "", assetId: undefined, altText: undefined });
  };

  const isPdf = value?.toLowerCase().endsWith(".pdf") ?? false;
  const hasValue = Boolean(value && value.trim().length > 0);

  return (
    <div className="space-y-2" ref={rootRef}>
      {name ? <input type="hidden" name={name} value={value ?? ""} /> : null}
      {label ? <label className="block text-sm font-medium text-brand-text">{label}</label> : null}

      {hasValue ? (
        <div className="relative flex items-center gap-4 rounded-lg border border-brand-border bg-brand-page p-3">
          <div className="flex h-16 w-20 shrink-0 items-center justify-center overflow-hidden rounded-md border border-brand-border bg-brand-surface">
            {isPdf ? (
              <FileText className="h-8 w-8 text-brand-danger" aria-hidden="true" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={value ?? ""}
                alt="Seçili medya"
                className="h-full w-full object-cover"
                onError={(event) => {
                  (event.target as HTMLImageElement).src =
                    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23f6f8fa'/%3E%3Ctext x='50' y='55' text-anchor='middle' font-size='10' fill='%23667085'%3EKırık Görsel%3C/text%3E%3C/svg%3E";
                }}
              />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-brand-text">{value}</p>
            <p className="text-[11px] text-brand-muted">{isPdf ? "PDF Belgesi" : "Görsel Dosyası"}</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={openPicker}
              disabled={disabled}
              className="flex items-center gap-1.5 rounded-lg border border-brand-border bg-brand-surface px-3 py-1.5 text-xs font-medium text-brand-text transition hover:bg-brand-page disabled:opacity-50"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Değiştir</span>
            </button>
            <button
              type="button"
              onClick={handleRemove}
              disabled={disabled}
              className="flex items-center gap-1 rounded-lg border border-brand-danger/20 bg-brand-danger/10 px-2.5 py-1.5 text-xs font-medium text-brand-danger transition hover:bg-brand-danger/20 disabled:opacity-50"
              aria-label="Medyayı kaldır"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={openPicker}
          disabled={disabled}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-brand-border bg-brand-page px-4 py-6 text-xs font-medium text-brand-muted transition hover:border-brand-primary hover:bg-brand-primary/5 hover:text-brand-primary disabled:opacity-50"
        >
          <ImageIcon className="h-5 w-5" aria-hidden="true" />
          <span>Medya Seç veya Yükle</span>
        </button>
      )}

      {description ? <p className="text-[11px] text-brand-muted">{description}</p> : null}

      <MediaPickerModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSelect={handleSelect}
        allowedKinds={allowedKinds}
        currentAssetId={assetId}
        activeLocale={activeLocale}
        contextLabel={liveContext ?? contextLabel ?? label}
        contextDescription={contextDescription ?? liveContext ?? contextLabel}
      />
    </div>
  );
}
