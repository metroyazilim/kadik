"use client";

import { useState, useTransition } from "react";
import {
  Archive,
  ArchiveRestore,
  Check,
  Copy,
  ExternalLink,
  Eye,
  FileText,
  Image as ImageIcon,
  LayoutGrid,
  List as ListIcon,
  Loader2,
  RotateCcw,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
  X,
  AlertTriangle,
} from "lucide-react";
import type { MediaAssetDto, MediaKind, MediaUsageReport } from "@/lib/media/types";
import {
  archiveMediaAction,
  deleteMediaAction,
  getMediaUsageReportAction,
  replaceMediaUsageAction,
  unarchiveMediaAction,
  updateMediaMetadataAction,
  verifyMediaStorageAction,
} from "./actions";
import { useMediaUpload } from "@/components/admin/useMediaUpload";

export function MediaLibraryView({ initialAssets }: { initialAssets: MediaAssetDto[] }) {
  const [assets, setAssets] = useState<MediaAssetDto[]>(initialAssets);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterKind, setFilterKind] = useState<MediaKind | "all">("all");
  const [showArchived, setShowArchived] = useState(false);

  // Selected asset for detail drawer
  const [activeAsset, setActiveAsset] = useState<MediaAssetDto | null>(null);
  const [altText, setAltText] = useState("");
  const [caption, setCaption] = useState("");
  const [usageReport, setUsageReport] = useState<MediaUsageReport | null>(null);
  const [loadingUsage, setLoadingUsage] = useState(false);

  // Upload modal state
  const [uploadModalOpen, setUploadModalOpen] = useState(false);

  // Replace-and-archive modal - reused for both "delete blocked by usage"
  // and "verified missing from storage" entry points; `replaceReason`
  // only changes the copy, not the mechanics.
  const [replaceModalOpen, setReplaceModalOpen] = useState(false);
  const [replaceReason, setReplaceReason] = useState<"dependency" | "missing">("dependency");
  const [replacementAssetId, setReplacementAssetId] = useState<string>("");

  // Feedback notification
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const upload = useMediaUpload((asset) => {
    setAssets((prev) => [asset, ...prev]);
    setUploadModalOpen(false);
    showNotification("success", asset.duplicate ? `'${asset.filename}' zaten kütüphanede mevcut.` : `'${asset.filename}' başarıyla yüklendi.`);
    handleOpenDetail(asset);
  });

  function showNotification(type: "success" | "error", text: string) {
    setFeedback({ type, text });
    setTimeout(() => setFeedback(null), 4000);
  }

  function handleCopy(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  }

  function handleOpenDetail(asset: MediaAssetDto) {
    setActiveAsset(asset);
    setAltText(asset.altText || "");
    setCaption(asset.caption || "");
    setUsageReport(null);
    setLoadingUsage(true);

    getMediaUsageReportAction(asset.id)
      .then((res) => {
        if (res.success && res.data) {
          setUsageReport(res.data);
        }
      })
      .finally(() => setLoadingUsage(false));
  }

  const handleSaveMetadata = () => {
    if (!activeAsset) return;

    startTransition(async () => {
      const res = await updateMediaMetadataAction(activeAsset.id, { altText, caption });
      if (res.success && res.data) {
        setAssets((prev) => prev.map((a) => (a.id === res.data!.id ? res.data! : a)));
        setActiveAsset(res.data);
        showNotification("success", res.message || "Bilgiler kaydedildi.");
      } else {
        showNotification("error", res.error || "Kaydedilemedi.");
      }
    });
  };

  const handleArchiveToggle = () => {
    if (!activeAsset) return;

    startTransition(async () => {
      const action = activeAsset.archived ? unarchiveMediaAction : archiveMediaAction;
      const res = await action(activeAsset.id);
      if (res.success && res.data) {
        setAssets((prev) => prev.map((a) => (a.id === res.data!.id ? res.data! : a)));
        setActiveAsset(res.data);
        showNotification("success", res.message || "Arşiv durumu güncellendi.");
      } else {
        showNotification("error", res.error || "İşlem başarısız.");
      }
    });
  };

  const handleDelete = () => {
    if (!activeAsset) return;

    startTransition(async () => {
      const res = await deleteMediaAction(activeAsset.id);
      if (res.success) {
        setAssets((prev) => prev.filter((a) => a.id !== activeAsset.id));
        setActiveAsset(null);
        setReplaceModalOpen(false);
        showNotification("success", "Medya başarıyla silindi.");
      } else if (res.code === "dependencyConflict" && res.report) {
        setUsageReport(res.report);
        setReplaceReason("dependency");
        setReplaceModalOpen(true);
      } else {
        showNotification("error", res.error || "Silinemedi.");
      }
    });
  };

  const handleVerifyStorage = () => {
    if (!activeAsset) return;

    startTransition(async () => {
      const res = await verifyMediaStorageAction(activeAsset.id);
      if (!res.success) {
        showNotification("error", res.error || "Depo doğrulaması başarısız.");
        return;
      }
      setAssets((prev) => prev.map((a) => (a.id === res.data!.id ? res.data! : a)));
      setActiveAsset(res.data);
      showNotification(res.data.storageStatus === "MISSING" ? "error" : "success", res.message || "");
      if (res.data.storageStatus === "MISSING" && usageReport && usageReport.totalUsages > 0) {
        setReplaceReason("missing");
        setReplaceModalOpen(true);
      }
    });
  };

  const handleReplaceAndArchive = () => {
    if (!activeAsset || !replacementAssetId) return;

    startTransition(async () => {
      const res = await replaceMediaUsageAction({
        oldAssetId: activeAsset.id,
        newAssetId: replacementAssetId,
        archiveOld: true,
      });

      if (res.success) {
        setAssets((prev) => prev.map((a) => (a.id === activeAsset.id ? { ...a, archived: true } : a)));
        setActiveAsset(null);
        setReplaceModalOpen(false);
        showNotification("success", "Kullanımlar aktarıldı ve eski dosya arşivlendi.");
      } else {
        showNotification("error", res.error || "Aktarım başarısız.");
      }
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) upload.start(file);
  };

  const filteredAssets = assets.filter((asset) => {
    if (!showArchived && asset.archived) return false;
    if (showArchived && !asset.archived) return false;

    if (filterKind === "image" && !asset.mimeType.startsWith("image/")) return false;
    if (filterKind === "document" && asset.mimeType !== "application/pdf") return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = asset.filename.toLowerCase().includes(q);
      const matchAlt = asset.altText?.toLowerCase().includes(q);
      const matchCaption = asset.caption?.toLowerCase().includes(q);
      return matchName || matchAlt || matchCaption;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Feedback Alert */}
      {feedback && (
        <div
          className={`rounded-[var(--radius-lg)] p-4 text-xs font-medium ${
            feedback.type === "success"
              ? "border border-brand-success/20 bg-brand-success/10 text-brand-success"
              : "border border-brand-danger/20 bg-brand-danger/10 text-brand-danger"
          }`}
        >
          {feedback.text}
        </div>
      )}

      {/* Main Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-[var(--radius-md)] border border-brand-border bg-brand-surface p-4 shadow-sm">
        {/* Search & Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted" />
            <input
              type="text"
              placeholder="Dosya veya alt metin ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-10 w-60 rounded-[var(--radius-sm)] border border-brand-border bg-brand-page pl-9 pr-3 text-xs text-brand-text placeholder:text-brand-muted focus:border-brand-primary focus:outline-none sm:w-72"
            />
          </div>

          <div className="flex rounded-[var(--radius-sm)] border border-brand-border bg-brand-page p-1 text-xs">
            <button
              type="button"
              onClick={() => setFilterKind("all")}
              className={`rounded-[var(--radius-sm)] px-3 py-1.5 font-medium transition ${
                filterKind === "all" ? "bg-brand-primary text-white" : "text-brand-muted hover:text-brand-text"
              }`}
            >
              Tümü
            </button>
            <button
              type="button"
              onClick={() => setFilterKind("image")}
              className={`rounded-[var(--radius-sm)] px-3 py-1.5 font-medium transition ${
                filterKind === "image" ? "bg-brand-primary text-white" : "text-brand-muted hover:text-brand-text"
              }`}
            >
              Görseller
            </button>
            <button
              type="button"
              onClick={() => setFilterKind("document")}
              className={`rounded-[var(--radius-sm)] px-3 py-1.5 font-medium transition ${
                filterKind === "document" ? "bg-brand-primary text-white" : "text-brand-muted hover:text-brand-text"
              }`}
            >
              PDF Belgeler
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowArchived((prev) => !prev)}
            className={`flex items-center gap-1.5 rounded-[var(--radius-sm)] border px-3 py-2 text-xs font-medium transition ${
              showArchived
                ? "border-brand-warning/30 bg-brand-warning/10 text-brand-warning"
                : "border-brand-border bg-brand-page text-brand-muted hover:text-brand-text"
            }`}
          >
            <Archive className="h-3.5 w-3.5" />
            <span>{showArchived ? "Arşivlenenler" : "Arşiv"}</span>
          </button>
        </div>

        {/* View Mode & Upload CTA */}
        <div className="flex items-center gap-3">
          <div className="flex rounded-[var(--radius-sm)] border border-brand-border bg-brand-page p-1">
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={`rounded-[var(--radius-sm)] p-1.5 transition ${
                viewMode === "grid" ? "bg-brand-surface text-brand-text shadow-sm" : "text-brand-muted hover:text-brand-text"
              }`}
              aria-label="Izgara Görünümü"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={`rounded-[var(--radius-sm)] p-1.5 transition ${
                viewMode === "list" ? "bg-brand-surface text-brand-text shadow-sm" : "text-brand-muted hover:text-brand-text"
              }`}
              aria-label="Liste Görünümü"
            >
              <ListIcon className="h-4 w-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => setUploadModalOpen(true)}
            className="flex items-center gap-2 rounded-[var(--radius-sm)] bg-brand-primary px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-primary/90"
          >
            <Upload className="h-4 w-4" />
            <span>Medya Yükle</span>
          </button>
        </div>
      </div>

      {/* Asset Display */}
      {filteredAssets.length === 0 ? (
        <div className="flex h-72 flex-col items-center justify-center rounded-[var(--radius-md)] border border-dashed border-brand-border p-8 text-center">
          <ImageIcon className="mb-3 h-12 w-12 text-brand-muted" />
          <p className="text-sm font-medium text-brand-text">Medya bulunamadı</p>
          <p className="mt-1 text-xs text-brand-muted">
            {showArchived
              ? "Arşivde herhangi bir medya dosyası bulunmuyor."
              : "Yeni bir görsel veya PDF yükleyerek kütüphanenizi oluşturun."}
          </p>
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {filteredAssets.map((asset) => {
            const isImg = asset.mimeType.startsWith("image/");
            const isSelected = activeAsset?.id === asset.id;
            const isMissing = asset.storageStatus === "MISSING";
            return (
              <button
                key={asset.id}
                type="button"
                onClick={() => handleOpenDetail(asset)}
                className={`group relative flex aspect-square flex-col overflow-hidden rounded-[var(--radius-md)] border text-left transition focus:outline-none ${
                  isSelected ? "border-brand-primary ring-2 ring-brand-primary/30" : "border-brand-border bg-brand-surface hover:border-brand-muted"
                }`}
              >
                {isImg && !isMissing ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={asset.url}
                    alt={asset.altText || asset.filename}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center bg-brand-page p-4 text-brand-muted">
                    {isMissing ? (
                      <AlertTriangle className="mb-2 h-10 w-10 text-brand-danger" />
                    ) : (
                      <FileText className="mb-2 h-10 w-10 text-brand-danger" />
                    )}
                    <span className="line-clamp-2 text-center text-xs text-brand-text">
                      {asset.filename}
                    </span>
                  </div>
                )}

                {/* Usage count pill */}
                {typeof asset.usageCount === "number" && asset.usageCount > 0 && (
                  <div className="absolute left-2 top-2 rounded-full bg-brand-text/80 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-xs">
                    {asset.usageCount} kullanım
                  </div>
                )}

                {isMissing ? (
                  <div className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-brand-danger px-2 py-0.5 text-[10px] font-medium text-white">
                    <AlertTriangle className="h-3 w-3" />
                    Depoda Yok
                  </div>
                ) : asset.archived ? (
                  <div className="absolute right-2 top-2 rounded-full bg-brand-warning px-2 py-0.5 text-[10px] font-medium text-white">
                    Arşiv
                  </div>
                ) : null}

                {/* Hover overlay */}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-brand-text/90 via-brand-text/50 to-transparent p-3 text-[11px] text-white opacity-0 transition group-hover:opacity-100">
                  <p className="truncate font-medium">{asset.filename}</p>
                  <p className="text-white/80">
                    {(asset.byteSize / 1024).toFixed(0)} KB
                    {asset.width && asset.height ? ` • ${asset.width}×${asset.height}` : ""}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="overflow-hidden rounded-[var(--radius-md)] border border-brand-border bg-brand-surface">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-brand-border bg-brand-page text-brand-muted">
              <tr>
                <th className="p-3">Medya</th>
                <th className="p-3">Dosya Adı</th>
                <th className="p-3">Tür</th>
                <th className="p-3">Boyut</th>
                <th className="p-3">Çözünürlük</th>
                <th className="p-3">Durum</th>
                <th className="p-3">Kullanım</th>
                <th className="p-3 text-right">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-border">
              {filteredAssets.map((asset) => (
                <tr
                  key={asset.id}
                  onClick={() => handleOpenDetail(asset)}
                  className="cursor-pointer transition hover:bg-brand-page"
                >
                  <td className="p-3">
                    <div className="h-10 w-12 overflow-hidden rounded-[var(--radius-sm)] border border-brand-border bg-brand-page">
                      {asset.mimeType.startsWith("image/") && asset.storageStatus !== "MISSING" ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={asset.url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-brand-danger">
                          <FileText className="h-5 w-5" />
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="p-3 font-medium text-brand-text">{asset.filename}</td>
                  <td className="p-3 font-mono text-brand-muted">{asset.mimeType}</td>
                  <td className="p-3 text-brand-muted">{(asset.byteSize / 1024).toFixed(1)} KB</td>
                  <td className="p-3 text-brand-muted">
                    {asset.width && asset.height ? `${asset.width}×${asset.height}` : "—"}
                  </td>
                  <td className="p-3">
                    {asset.storageStatus === "MISSING" ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-brand-danger/10 px-2 py-0.5 text-[10px] font-medium text-brand-danger">
                        <AlertTriangle className="h-3 w-3" />
                        Depoda Yok
                      </span>
                    ) : asset.archived ? (
                      <span className="inline-flex items-center rounded-full bg-brand-warning/10 px-2 py-0.5 text-[10px] font-medium text-brand-warning">
                        Arşiv
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-brand-success/10 px-2 py-0.5 text-[10px] font-medium text-brand-success">
                        Aktif
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-brand-muted">{asset.usageCount || 0}</td>
                  <td className="p-3 text-right">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleOpenDetail(asset);
                      }}
                      className="rounded-[var(--radius-sm)] p-1.5 text-brand-muted hover:bg-brand-page hover:text-brand-text"
                      aria-label="Ayrıntıları görüntüle"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail & Metadata Drawer / Modal */}
      {activeAsset && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-end bg-brand-text/40 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="flex h-full w-full max-w-xl flex-col border-l border-brand-border bg-brand-surface shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-brand-border px-6 py-4">
              <h3 className="text-sm font-semibold text-brand-text">Medya Ayrıntıları</h3>
              <button
                type="button"
                onClick={() => setActiveAsset(null)}
                className="rounded-[var(--radius-sm)] p-2 text-brand-muted hover:bg-brand-page hover:text-brand-text"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 space-y-6 overflow-y-auto p-6 text-xs">
              {activeAsset.storageStatus === "MISSING" ? (
                <div role="alert" className="flex items-start gap-2 rounded-[var(--radius-md)] border border-brand-danger/20 bg-brand-danger/10 p-3 text-brand-danger">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>Bu dosya depoda bulunamadı (silinmiş veya taşınmış olabilir). Kullanan içerikler kırık görsel gösterebilir - aşağıdan yerine bir dosya seçin.</p>
                </div>
              ) : null}

              {/* Preview */}
              <div className="flex min-h-[180px] items-center justify-center overflow-hidden rounded-[var(--radius-md)] border border-brand-border bg-brand-page p-4">
                {activeAsset.mimeType.startsWith("image/") && activeAsset.storageStatus !== "MISSING" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={activeAsset.url}
                    alt={activeAsset.altText || activeAsset.filename}
                    className="max-h-60 max-w-full rounded-[var(--radius-sm)] object-contain shadow-sm"
                  />
                ) : (
                  <div className="flex flex-col items-center text-brand-muted">
                    {activeAsset.storageStatus === "MISSING" ? (
                      <AlertTriangle className="h-16 w-16 text-brand-danger" />
                    ) : (
                      <FileText className="h-16 w-16 text-brand-danger" />
                    )}
                    <span className="mt-2 text-sm font-medium text-brand-text">{activeAsset.filename}</span>
                    <a
                      href={activeAsset.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 flex items-center gap-1.5 rounded-[var(--radius-sm)] bg-brand-primary px-3 py-1.5 text-xs text-white hover:bg-brand-primary/90"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      <span>Belgeyi Aç / İndir</span>
                    </a>
                  </div>
                )}
              </div>

              {/* Technical Metadata Box */}
              <div className="space-y-2 rounded-[var(--radius-md)] border border-brand-border bg-brand-page p-4">
                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-brand-muted">
                  Dosya Bilgileri
                </h4>
                <div className="grid grid-cols-2 gap-2 text-brand-text">
                  <div>
                    <span className="text-brand-muted">MIME Türü:</span>
                    <p className="font-mono text-[11px]">{activeAsset.mimeType}</p>
                  </div>
                  <div>
                    <span className="text-brand-muted">Boyut:</span>
                    <p>{(activeAsset.byteSize / 1024).toFixed(1)} KB ({activeAsset.byteSize.toLocaleString()} B)</p>
                  </div>
                  {activeAsset.width && activeAsset.height && (
                    <div>
                      <span className="text-brand-muted">Çözünürlük:</span>
                      <p>{activeAsset.width} × {activeAsset.height} px</p>
                    </div>
                  )}
                  <div>
                    <span className="text-brand-muted">Yüklenme Tarihi:</span>
                    <p>{new Date(activeAsset.createdAt).toLocaleDateString("tr-TR")}</p>
                  </div>
                </div>

                <div className="pt-2">
                  <span className="text-brand-muted">SHA-256 Checksum:</span>
                  <div className="mt-1 flex items-center gap-2">
                    <code className="truncate rounded-[var(--radius-sm)] bg-brand-surface px-2 py-1 text-[10px] text-brand-text">
                      {activeAsset.checksum}
                    </code>
                    <button
                      type="button"
                      onClick={() => handleCopy(activeAsset.checksum, "checksum")}
                      className="rounded-[var(--radius-sm)] p-1 text-brand-muted hover:text-brand-text"
                      title="Kopyala"
                    >
                      {copiedKey === "checksum" ? <Check className="h-3.5 w-3.5 text-brand-success" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="pt-2">
                  <span className="text-brand-muted">Public URL:</span>
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={activeAsset.url}
                      className="w-full truncate rounded-[var(--radius-sm)] border border-brand-border bg-brand-surface px-2 py-1 text-[11px] text-brand-text"
                    />
                    <button
                      type="button"
                      onClick={() => handleCopy(activeAsset.url, "url")}
                      className="rounded-[var(--radius-sm)] p-1 text-brand-muted hover:text-brand-text"
                      title="Kopyala"
                    >
                      {copiedKey === "url" ? <Check className="h-3.5 w-3.5 text-brand-success" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Editable Alt Text & Caption */}
              <div className="space-y-3">
                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-brand-muted">
                  Varsayılan Açıklamalar
                </h4>
                <div>
                  <label className="mb-1 block text-brand-text">Alt Metin (Erişilebilirlik)</label>
                  <input
                    type="text"
                    value={altText}
                    onChange={(e) => setAltText(e.target.value)}
                    placeholder="Görseli tarif eden metin..."
                    className="w-full rounded-[var(--radius-sm)] border border-brand-border bg-brand-page p-2.5 text-brand-text placeholder:text-brand-muted focus:border-brand-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-brand-text">Açıklama / Başlık (Caption)</label>
                  <input
                    type="text"
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    placeholder="Görsel altı başlığı..."
                    className="w-full rounded-[var(--radius-sm)] border border-brand-border bg-brand-page p-2.5 text-brand-text placeholder:text-brand-muted focus:border-brand-primary focus:outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleSaveMetadata}
                  disabled={isPending}
                  className="rounded-[var(--radius-sm)] bg-brand-page px-4 py-2 font-medium text-brand-text transition hover:bg-brand-border disabled:opacity-50"
                >
                  {isPending ? "Kaydediliyor..." : "Metinleri Güncelle"}
                </button>
              </div>

              {/* Usages Section */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-[11px] font-semibold uppercase tracking-wider text-brand-muted">
                    İçerik Kullanımları
                  </h4>
                  <span className="text-[11px] text-brand-muted">
                    {loadingUsage ? "Taranıyor..." : `${usageReport?.totalUsages || 0} bağlantı`}
                  </span>
                </div>

                {loadingUsage ? (
                  <div className="flex items-center gap-2 text-brand-muted">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Kullanım bağımlılıkları taranıyor...</span>
                  </div>
                ) : usageReport && usageReport.usages.length > 0 ? (
                  <div className="space-y-2 rounded-[var(--radius-md)] border border-brand-border bg-brand-page p-3">
                    {usageReport.usages.map((u) => (
                      <div
                        key={u.id}
                        className="flex items-center justify-between rounded-[var(--radius-md)] bg-brand-surface px-3 py-2 text-xs"
                      >
                        <div>
                          <span className="font-semibold text-brand-text">{u.surface}</span>
                          <span className="text-brand-muted"> • alan: {u.field}</span>
                          {u.locale && (
                            <span className="ml-2 rounded-[var(--radius-sm)] bg-brand-primary/10 px-1.5 py-0.5 text-[10px] text-brand-primary">
                              {u.locale.toUpperCase()}
                            </span>
                          )}
                        </div>
                        {u.entityContentType && (
                          <span className="text-[10px] text-brand-muted">{u.entityContentType}</span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-brand-muted">Bu medya şu anda herhangi bir içerik tarafından kullanılmıyor.</p>
                )}
              </div>

              {/* Danger / Action Zone */}
              <div className="space-y-3 border-t border-brand-border pt-6">
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={handleVerifyStorage}
                    disabled={isPending}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-[var(--radius-sm)] border border-brand-border bg-brand-page py-2.5 font-medium text-brand-text transition hover:bg-brand-border disabled:opacity-50"
                  >
                    <ShieldCheck className="h-4 w-4" />
                    <span>Depoda Doğrula</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleArchiveToggle}
                    disabled={isPending}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-[var(--radius-sm)] border border-brand-warning/20 bg-brand-warning/10 py-2.5 font-medium text-brand-warning transition hover:bg-brand-warning/20 disabled:opacity-50"
                  >
                    {activeAsset.archived ? (
                      <>
                        <ArchiveRestore className="h-4 w-4" />
                        <span>Arşivden Çıkar</span>
                      </>
                    ) : (
                      <>
                        <Archive className="h-4 w-4" />
                        <span>Arşive Kaldır</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={isPending}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-[var(--radius-sm)] border border-brand-danger/20 bg-brand-danger/10 py-2.5 font-medium text-brand-danger transition hover:bg-brand-danger/20 disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span>Kalıcı Olarak Sil</span>
                  </button>
                </div>
                {(usageReport?.totalUsages ?? 0) > 0 ? (
                  <p className="text-[11px] text-brand-muted">
                    Bu medya {usageReport?.totalUsages} içerik tarafından kullanılıyor - kullanılan medya doğrudan silinemez; önce yerine başka bir dosya seçip aktarın.
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {uploadModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-brand-text/40 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-[var(--radius-lg)] border border-brand-border bg-brand-surface p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-brand-border pb-3">
              <h3 className="text-sm font-semibold text-brand-text">Yeni Medya Yükle</h3>
              <button
                type="button"
                onClick={() => setUploadModalOpen(false)}
                className="rounded-[var(--radius-sm)] p-1.5 text-brand-muted hover:text-brand-text"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              {upload.state.status === "idle" ? (
                <label className="flex h-44 cursor-pointer flex-col items-center justify-center rounded-[var(--radius-md)] border-2 border-dashed border-brand-border bg-brand-page p-6 text-center transition hover:border-brand-primary">
                  <Upload className="mb-2 h-8 w-8 text-brand-primary" />
                  <p className="text-xs font-medium text-brand-text">Dosya seçin veya buraya sürükleyin</p>
                  <p className="mt-1 text-[10px] text-brand-muted">
                    JPEG, PNG, WebP, GIF (max 10MB) • SVG (max 2MB) • PDF (max 25MB)
                  </p>
                  <input
                    type="file"
                    onChange={handleFileUpload}
                    accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml,application/pdf"
                    className="hidden"
                  />
                </label>
              ) : upload.state.status === "uploading" || upload.state.status === "finalizing" ? (
                <div className="flex h-44 flex-col items-center justify-center rounded-[var(--radius-md)] border border-brand-border bg-brand-page p-6 text-center">
                  <Loader2 className="mb-2 h-8 w-8 animate-spin text-brand-primary" />
                  <p className="text-xs font-medium text-brand-text">
                    {upload.state.status === "finalizing" ? `'${upload.state.fileName}' doğrulanıyor...` : `'${upload.state.fileName}' yükleniyor...`}
                  </p>
                  {upload.state.status === "uploading" ? (
                    <>
                      <div className="mt-3 h-1.5 w-full max-w-[220px] overflow-hidden rounded-full bg-brand-border">
                        <div className="h-full bg-brand-primary transition-all" style={{ width: `${upload.state.progress}%` }} />
                      </div>
                      <p className="mt-1 text-[10px] text-brand-muted">%{upload.state.progress}</p>
                      <button type="button" onClick={upload.cancel} className="mt-3 rounded-[var(--radius-sm)] border border-brand-border px-3 py-1.5 text-xs font-medium text-brand-muted hover:text-brand-text">
                        İptal
                      </button>
                    </>
                  ) : null}
                </div>
              ) : (
                <div role="alert" className="flex h-44 flex-col items-center justify-center rounded-[var(--radius-md)] border border-brand-danger/20 bg-brand-danger/10 p-6 text-center">
                  <AlertTriangle className="mb-2 h-8 w-8 text-brand-danger" />
                  <p className="text-xs font-medium text-brand-danger">{upload.state.message}</p>
                  <div className="mt-3 flex gap-2">
                    <button type="button" onClick={upload.retry} className="flex items-center gap-1 rounded-[var(--radius-sm)] border border-brand-danger/30 px-3 py-1.5 text-xs font-medium text-brand-danger hover:bg-brand-danger/10">
                      <RotateCcw className="h-3.5 w-3.5" />
                      Tekrar Dene
                    </button>
                    <button type="button" onClick={upload.dismissError} className="rounded-[var(--radius-sm)] border border-brand-border px-3 py-1.5 text-xs font-medium text-brand-muted hover:text-brand-text">
                      Vazgeç
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Replace & Delete Dependency Warning Modal */}
      {replaceModalOpen && activeAsset && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-brand-text/50 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg rounded-[var(--radius-lg)] border border-brand-warning/30 bg-brand-surface p-6 shadow-xl">
            <div className="flex items-center gap-3 border-b border-brand-border pb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-sm)] bg-brand-warning/10 text-brand-warning">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-brand-text">
                  {replaceReason === "missing" ? "Medya Depoda Bulunamadı" : "Medya Kullanımda"}
                </h3>
                <p className="text-xs text-brand-muted">
                  {replaceReason === "missing"
                    ? `Bu dosya depoda yok ve ${usageReport?.totalUsages || 0} içerik tarafından kullanılıyor.`
                    : `Bu medya ${usageReport?.totalUsages || 0} içerik tarafından kullanılıyor.`}
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              <p className="text-brand-text">
                <span className="font-semibold">{activeAsset.filename}</span>{" "}
                {replaceReason === "missing"
                  ? "kullanan sayfalarda kırık görsel gösterecektir. Kullanımları başka bir dosyaya taşıyın."
                  : "doğrudan silinirse yayındaki sayfalarda kırık görsel veya içerik kaybı oluşacaktır."}
              </p>

              <div>
                <label className="mb-1 block font-medium text-brand-text">
                  Yerine Kullanılacak Yeni Medyayı Seçin:
                </label>
                <select
                  value={replacementAssetId}
                  onChange={(e) => setReplacementAssetId(e.target.value)}
                  className="w-full rounded-[var(--radius-sm)] border border-brand-border bg-brand-page p-2.5 text-brand-text focus:border-brand-primary focus:outline-none"
                >
                  <option value="">-- Bir yedek medya seçin --</option>
                  {assets
                    .filter((a) => a.id !== activeAsset.id && !a.archived && a.storageStatus !== "MISSING")
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.filename} ({(a.byteSize / 1024).toFixed(0)} KB)
                      </option>
                    ))}
                </select>
              </div>

              <div className="flex flex-col gap-2 pt-2 sm:flex-row">
                <button
                  type="button"
                  disabled={!replacementAssetId || isPending}
                  onClick={handleReplaceAndArchive}
                  className="flex-1 rounded-[var(--radius-sm)] bg-brand-primary py-2.5 font-medium text-white transition hover:bg-brand-primary/90 disabled:opacity-50"
                >
                  Kullanımları Taşı ve Arşivle
                </button>
                <button
                  type="button"
                  onClick={() => setReplaceModalOpen(false)}
                  className="rounded-[var(--radius-sm)] border border-brand-border px-4 py-2.5 font-medium text-brand-muted hover:text-brand-text"
                >
                  Vazgeç
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
