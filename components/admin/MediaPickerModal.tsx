"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Check, FileText, Image as ImageIcon, Loader2, RotateCcw, Search, Upload, X } from "lucide-react";
import type { MediaAssetDto, MediaKind, MediaPickerProps, MediaSelectPayload } from "@/lib/media/types";
import { useMediaUpload } from "./useMediaUpload";
import { updateMediaMetadataAction } from "@/app/manage/(panel)/media/actions";

function toSelectPayload(asset: MediaAssetDto): MediaSelectPayload {
  return {
    assetId: asset.id,
    url: asset.url,
    filename: asset.filename,
    mimeType: asset.mimeType,
    width: asset.width,
    height: asset.height,
    altText: asset.altText,
    caption: asset.caption,
  };
}

/**
 * The sole entry point for setting an image anywhere in admin (FR-14, AD-9).
 * Two paths, no third: browse-and-select an existing `MediaAsset`, or upload
 * a new file (which becomes a `MediaAsset` and is immediately selected).
 * There is never a manual URL text field here. `multiple` switches the
 * right-hand panel from a single-asset detail view to a checkbox
 * multi-select summary for gallery-style fields (`MediaGalleryField`).
 */
export function MediaPickerModal({
  open,
  onClose,
  onSelect,
  multiple = false,
  onSelectMultiple,
  allowedKinds = ["image", "document"],
  currentAssetId,
  activeLocale,
  contextLabel,
  contextDescription,
}: MediaPickerProps) {
  // Placeholders show the actual content this image belongs to - the site
  // brand on the hero, the post/project title on a collection cover - so the
  // admin can accept the obvious alt text instead of composing one.
  const altPlaceholder = contextLabel?.trim() || "Görsel içeriğini açıklayan metin...";
  const captionPlaceholder =
    contextDescription?.trim() || contextLabel?.trim() || "Görsel altı başlık veya detay...";
  const [assets, setAssets] = useState<MediaAssetDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedKind, setSelectedKind] = useState<MediaKind | "all">("all");
  const [selectedAsset, setSelectedAsset] = useState<MediaAssetDto | null>(null);
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set());
  const [altTextOverride, setAltTextOverride] = useState("");
  const [captionOverride, setCaptionOverride] = useState("");
  const [listError, setListError] = useState<string | null>(null);
  const [prevOpen, setPrevOpen] = useState(open);

  const upload = useMediaUpload((asset) => {
    setAssets((prev) => [asset, ...prev]);
    if (multiple) {
      setSelectedIds((prev) => new Set(prev).add(asset.id));
    } else {
      setSelectedAsset(asset);
      setAltTextOverride(asset.altText || "");
      setCaptionOverride(asset.caption || "");
    }
  });

  // Reset selection/error when the modal transitions closed - adjusted
  // during render (React's documented pattern for state derived from a prop
  // change), not in an effect, which would cause an extra commit.
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (!open) {
      setSelectedAsset(null);
      setSelectedIds(new Set());
      setListError(null);
    } else {
      setLoading(true);
    }
  }

  useEffect(() => {
    if (!open) return;
    fetch("/api/manage/media/list")
      .then((res) => res.json())
      .then((data) => {
        if (data.ok && Array.isArray(data.assets)) {
          setAssets(data.assets);
          if (currentAssetId) {
            const found = data.assets.find((asset: MediaAssetDto) => asset.id === currentAssetId);
            if (found) {
              setSelectedAsset(found);
              setAltTextOverride(found.altText || "");
              setCaptionOverride(found.caption || "");
            }
          }
        }
      })
      .catch(() => setListError("Medya listesi yüklenemedi."))
      .finally(() => setLoading(false));
  }, [open, currentAssetId]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && open) onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const filteredAssets = assets.filter((asset) => {
    if (asset.archived) return false;
    if (selectedKind !== "all") {
      const isImg = asset.mimeType.startsWith("image/");
      const isDoc = asset.mimeType === "application/pdf";
      if (selectedKind === "image" && !isImg) return false;
      if (selectedKind === "document" && !isDoc) return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        asset.filename.toLowerCase().includes(q) ||
        Boolean(asset.altText?.toLowerCase().includes(q)) ||
        Boolean(asset.caption?.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const handleAssetClick = (asset: MediaAssetDto) => {
    if (multiple) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(asset.id)) {
          next.delete(asset.id);
        } else {
          next.add(asset.id);
        }
        return next;
      });
      return;
    }
    setSelectedAsset(asset);
    setAltTextOverride(asset.altText || "");
    setCaptionOverride(asset.caption || "");
  };

  // "Bu Medyayı Kullan" is also the save button for the two text fields:
  // whatever the admin typed is written back onto the MediaAsset itself, so
  // the next screen that picks this asset already carries the same texts.
  const handleConfirmSelect = async () => {
    if (!selectedAsset) return;
    const resolvedAlt = altTextOverride.trim() || captionOverride.trim() || contextLabel?.trim() || selectedAsset.altText || "Görsel";
    const resolvedCaption = captionOverride.trim() || altTextOverride.trim() || contextLabel?.trim() || selectedAsset.caption || null;

    if (resolvedAlt !== selectedAsset.altText || resolvedCaption !== selectedAsset.caption) {
      const saved = await updateMediaMetadataAction(selectedAsset.id, {
        altText: resolvedAlt,
        caption: resolvedCaption,
      });
      if (saved.success) {
        setAssets((current) => current.map((asset) => (asset.id === saved.data.id ? saved.data : asset)));
      }
    }

    onSelect?.({
      ...toSelectPayload(selectedAsset),
      altText: resolvedAlt,
      caption: resolvedCaption,
    });
    onClose();
  };
  const handleConfirmMultiSelect = () => {
    const chosen = assets.filter((asset) => selectedIds.has(asset.id));
    onSelectMultiple?.(chosen.map(toSelectPayload));
    onClose();
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) {
      upload.start(file, {
        altText: altTextOverride.trim() || captionOverride.trim() || contextLabel?.trim() || undefined,
        caption: captionOverride.trim() || altTextOverride.trim() || contextLabel?.trim() || undefined,
      });
    }
  };

  const acceptAttr =
    allowedKinds.includes("image") && allowedKinds.includes("document")
      ? "image/jpeg,image/png,image/webp,image/gif,image/svg+xml,application/pdf"
      : allowedKinds.includes("image")
        ? "image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
        : "application/pdf";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-text/40 p-4" role="dialog" aria-modal="true" aria-labelledby="media-picker-title">
      <div className="flex h-[85vh] w-full max-w-5xl flex-col rounded-xl border border-brand-border bg-brand-surface shadow-xl">
        <div className="flex items-center justify-between border-b border-brand-border px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-primary/10 text-brand-primary">
              <ImageIcon className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h2 id="media-picker-title" className="text-lg font-semibold text-brand-text">
                Medya Seçici
              </h2>
              <p className="text-xs text-brand-muted">
                {multiple ? "Kütüphaneden birden fazla medya seçin veya doğrudan yeni dosya yükleyin." : "Kütüphaneden medya seçin veya doğrudan yeni dosya yükleyin."}
                {activeLocale ? ` (${activeLocale.toUpperCase()} için)` : ""}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-brand-muted hover:bg-brand-page hover:text-brand-text" aria-label="Kapat">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-brand-border bg-brand-page px-6 py-3">
          <div className="flex items-center gap-3">
            <div className="flex rounded-lg border border-brand-border bg-brand-surface p-1 text-xs">
              <button
                type="button"
                onClick={() => setSelectedKind("all")}
                className={`rounded-md px-3 py-1.5 font-medium transition ${selectedKind === "all" ? "bg-brand-primary text-white" : "text-brand-muted hover:text-brand-text"}`}
              >
                Tümü
              </button>
              {allowedKinds.includes("image") ? (
                <button
                  type="button"
                  onClick={() => setSelectedKind("image")}
                  className={`rounded-md px-3 py-1.5 font-medium transition ${selectedKind === "image" ? "bg-brand-primary text-white" : "text-brand-muted hover:text-brand-text"}`}
                >
                  Görseller
                </button>
              ) : null}
              {allowedKinds.includes("document") ? (
                <button
                  type="button"
                  onClick={() => setSelectedKind("document")}
                  className={`rounded-md px-3 py-1.5 font-medium transition ${selectedKind === "document" ? "bg-brand-primary text-white" : "text-brand-muted hover:text-brand-text"}`}
                >
                  Belgeler (PDF)
                </button>
              ) : null}
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted" aria-hidden="true" />
              <input
                type="text"
                placeholder="Medya ara..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="h-9 w-48 rounded-lg border border-brand-border bg-brand-surface pl-9 pr-3 text-xs text-brand-text placeholder:text-brand-muted focus:border-brand-primary focus:outline-none md:w-64"
              />
            </div>
          </div>

          {upload.state.status === "idle" ? (
            <label className="flex cursor-pointer items-center gap-2 rounded-lg bg-brand-primary px-4 py-2 text-xs font-medium text-white transition hover:bg-brand-primary/90">
              <Upload className="h-4 w-4" aria-hidden="true" />
              <span>Yeni Yükle</span>
              <input type="file" onChange={handleFileUpload} accept={acceptAttr} className="hidden" />
            </label>
          ) : null}
        </div>

        {upload.state.status === "uploading" || upload.state.status === "finalizing" ? (
          <div className="flex items-center gap-3 border-b border-brand-border bg-brand-primary/5 px-6 py-3 text-xs text-brand-text">
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-brand-primary" aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate">
              {upload.state.status === "finalizing"
                ? `'${upload.state.fileName}' doğrulanıyor...`
                : `'${upload.state.fileName}' yükleniyor...`}
            </span>
            {upload.state.status === "uploading" ? (
              <>
                <div className="h-1.5 w-32 shrink-0 overflow-hidden rounded-full bg-brand-border">
                  <div className="h-full bg-brand-primary transition-all" style={{ width: `${upload.state.progress}%` }} />
                </div>
                <span className="w-9 shrink-0 text-right font-mono">{upload.state.progress}%</span>
                <button type="button" onClick={upload.cancel} className="shrink-0 rounded-lg border border-brand-border px-2.5 py-1 font-medium text-brand-muted hover:text-brand-text">
                  İptal
                </button>
              </>
            ) : null}
          </div>
        ) : null}

        {upload.state.status === "error" ? (
          <div role="alert" className="flex items-center gap-3 border-b border-brand-danger/20 bg-brand-danger/10 px-6 py-3 text-xs text-brand-danger">
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="min-w-0 flex-1">{upload.state.message}</span>
            <button type="button" onClick={upload.retry} className="flex shrink-0 items-center gap-1 rounded-lg border border-brand-danger/30 px-2.5 py-1 font-medium hover:bg-brand-danger/10">
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              Tekrar Dene
            </button>
            <button type="button" onClick={upload.dismissError} className="shrink-0 rounded-lg border border-brand-border px-2.5 py-1 font-medium text-brand-muted hover:text-brand-text">
              Vazgeç
            </button>
          </div>
        ) : null}

        {listError ? (
          <div role="alert" className="bg-brand-danger/10 px-6 py-2 text-xs text-brand-danger">
            {listError}
          </div>
        ) : null}

        <div className="grid flex-1 grid-cols-1 overflow-hidden lg:grid-cols-3">
          <div className="col-span-2 overflow-y-auto p-6">
            {loading ? (
              <div className="flex h-64 items-center justify-center text-brand-muted">
                <Loader2 className="mr-2 h-6 w-6 animate-spin text-brand-primary" aria-hidden="true" />
                <span>Yükleniyor...</span>
              </div>
            ) : filteredAssets.length === 0 ? (
              <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-dashed border-brand-border p-8 text-center text-brand-muted">
                <ImageIcon className="mb-2 h-10 w-10 text-brand-muted" aria-hidden="true" />
                <p className="text-sm font-medium text-brand-text">Medya bulunamadı</p>
                <p className="text-xs">Yeni bir dosya yükleyin veya arama kriterlerini değiştirin.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
                {filteredAssets.map((asset) => {
                  const isSelected = multiple ? selectedIds.has(asset.id) : selectedAsset?.id === asset.id;
                  const isImg = asset.mimeType.startsWith("image/");
                  const isMissing = asset.storageStatus === "MISSING";
                  return (
                    <button
                      key={asset.id}
                      type="button"
                      onClick={() => handleAssetClick(asset)}
                      className={`group relative flex aspect-square flex-col overflow-hidden rounded-xl border text-left transition focus:outline-none ${
                        isSelected ? "border-brand-primary ring-2 ring-brand-primary/30" : "border-brand-border bg-brand-page hover:border-brand-muted"
                      }`}
                    >
                      {isImg ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={asset.url} alt={asset.altText || asset.filename} className="h-full w-full object-cover" loading="lazy" />
                      ) : (
                        <div className="flex h-full w-full flex-col items-center justify-center bg-brand-page p-3 text-brand-muted">
                          <FileText className="mb-1 h-8 w-8 text-brand-danger" aria-hidden="true" />
                          <span className="line-clamp-2 text-center text-[10px] text-brand-text">{asset.filename}</span>
                        </div>
                      )}

                      {isMissing ? (
                        <div className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-brand-danger px-2 py-0.5 text-[10px] font-medium text-white">
                          <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                          Depoda Yok
                        </div>
                      ) : null}

                      {isSelected ? (
                        <div className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-brand-primary text-white shadow-md">
                          <Check className="h-3.5 w-3.5" aria-hidden="true" />
                        </div>
                      ) : null}

                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-brand-text/80 via-brand-text/40 to-transparent p-2 text-[10px] text-white opacity-0 transition group-hover:opacity-100">
                        <p className="truncate font-medium">{asset.filename}</p>
                        <p>
                          {(asset.byteSize / 1024).toFixed(0)} KB
                          {asset.width && asset.height ? ` • ${asset.width}×${asset.height}` : ""}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex flex-col border-t border-brand-border bg-brand-page p-6 lg:border-t-0 lg:border-l">
            {multiple ? (
              <>
                <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-brand-muted">Seçim</h3>
                <p className="text-sm font-medium text-brand-text">{selectedIds.size} görsel seçildi</p>
                <p className="mt-1 text-xs text-brand-muted">Izgaradaki bir medyaya tıklayarak seçime ekleyin veya kaldırın.</p>
                <div className="mt-auto pt-4">
                  <button
                    type="button"
                    onClick={handleConfirmMultiSelect}
                    disabled={selectedIds.size === 0}
                    className="w-full rounded-lg bg-brand-primary py-2.5 text-xs font-medium text-white shadow-sm transition hover:bg-brand-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Seçilenleri Ekle ({selectedIds.size})
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-brand-muted">Seçilen Medya Detayı</h3>

                {selectedAsset ? (
                  <div className="flex flex-1 flex-col space-y-4">
                    <div className="flex h-36 items-center justify-center overflow-hidden rounded-lg border border-brand-border bg-brand-surface p-2">
                      {selectedAsset.mimeType.startsWith("image/") ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={selectedAsset.url} alt={selectedAsset.altText || selectedAsset.filename} className="max-h-full max-w-full object-contain" />
                      ) : (
                        <div className="flex flex-col items-center text-brand-muted">
                          <FileText className="h-10 w-10 text-brand-danger" aria-hidden="true" />
                          <span className="mt-1 text-xs">{selectedAsset.filename}</span>
                        </div>
                      )}
                    </div>

                    {selectedAsset.storageStatus === "MISSING" ? (
                      <div className="flex items-center gap-2 rounded-lg border border-brand-danger/20 bg-brand-danger/10 p-2.5 text-[11px] text-brand-danger">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        Bu dosya depoda bulunamadı. Medya kütüphanesinden doğrulayıp değiştirin.
                      </div>
                    ) : null}

                    <div className="space-y-1 text-xs text-brand-text">
                      <div className="flex justify-between">
                        <span className="text-brand-muted">Dosya Adı:</span>
                        <span className="truncate pl-2 font-mono">{selectedAsset.filename}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-brand-muted">Tür:</span>
                        <span className="font-mono">{selectedAsset.mimeType}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-brand-muted">Boyut:</span>
                        <span>{(selectedAsset.byteSize / 1024).toFixed(1)} KB</span>
                      </div>
                      {selectedAsset.width && selectedAsset.height ? (
                        <div className="flex justify-between">
                          <span className="text-brand-muted">Çözünürlük:</span>
                          <span>
                            {selectedAsset.width} × {selectedAsset.height} px
                          </span>
                        </div>
                      ) : null}
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium text-brand-text">Alt Metin (Erişilebilirlik)</label>
                      <input
                        type="text"
                        value={altTextOverride}
                        onChange={(event) => setAltTextOverride(event.target.value)}
                        placeholder={altPlaceholder}
                        className="w-full rounded-lg border border-brand-border bg-brand-surface px-3 py-2 text-xs text-brand-text placeholder:text-brand-muted focus:border-brand-primary focus:outline-none"
                      />
                      <p className="mt-1 text-[10px] text-brand-muted">Ekran okuyucular ve SEO için görselin anlamını yazın.</p>
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium text-brand-text">Açıklama / Başlık (Opsiyonel)</label>
                      <input
                        type="text"
                        value={captionOverride}
                        onChange={(event) => setCaptionOverride(event.target.value)}
                        placeholder={captionPlaceholder}
                        className="w-full rounded-lg border border-brand-border bg-brand-surface px-3 py-2 text-xs text-brand-text placeholder:text-brand-muted focus:border-brand-primary focus:outline-none"
                      />
                    </div>

                    <div className="mt-auto pt-4">
                      <button
                        type="button"
                        onClick={handleConfirmSelect}
                        className="w-full rounded-lg bg-brand-primary py-2.5 text-xs font-medium text-white shadow-sm transition hover:bg-brand-primary/90"
                      >
                        Bu Medyayı Kullan
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-1 flex-col items-center justify-center text-center text-xs text-brand-muted">
                    <ImageIcon className="mb-2 h-8 w-8 text-brand-muted" aria-hidden="true" />
                    <span>Kullanmak istediğiniz medyaya tıklayarak seçin.</span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
