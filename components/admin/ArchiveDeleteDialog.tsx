"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import type { EntityDependencyReport } from "@/lib/content-model/entity-dependency";
import { primaryButton, secondaryButton } from "./ui";


export type ArchiveDeleteDialogProps = Readonly<{
  open: boolean;
  onClose: () => void;
  entityLabel: string;
  archived: boolean;
  /** Fetched by the caller (a small server action) when the dialog opens - never guessed client-side. `null` while loading. */
  report: EntityDependencyReport | null;
  onArchive: (input: { archived: boolean; acknowledgedImpact: boolean }) => void;
  onDelete: () => void;
  pending?: boolean;
  /** Server-side refusal (permission, dependency guard) for the last
   * attempt; shown in place of closing the dialog silently. */
  errorMessage?: string | null;
}>;

/**
 * Story 3.5's confirmation surface: "yönetici etkileri görmeden işlem
 * tamamlanmaz". Every archive/unarchive and delete action across every
 * domain's list view opens this instead of a bare confirm() - the impact
 * (published locales, live routes, last-in-collection) is always shown
 * before either button is enabled, sourced from `getEntityDependencyReport`
 * via the caller's per-domain server action, never assembled here.
 */
export function ArchiveDeleteDialog({
  open,
  onClose,
  entityLabel,
  archived,
  report,
  onArchive,
  onDelete,
  pending = false,
  errorMessage = null,
}: ArchiveDeleteDialogProps) {
  // No effect-based reset needed: every caller conditionally mounts this
  // component only while its target is set (`{target ? <ArchiveDeleteDialog
  // .../> : null}`), so a fresh `acknowledged` state is already guaranteed
  // by React discarding this component's state on unmount between opens.
  const [acknowledged, setAcknowledged] = useState(false);

  if (!open) return null;

  const hasImpact = Boolean(report && (report.liveRoutes.length > 0 || report.isLastPublishedInCollection));
  const deleteEligible = Boolean(report && report.publishedLocales.length === 0 && report.liveRoutes.length === 0);
  const archiveDisabled = pending || (!archived && hasImpact && !acknowledged);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-text/40 p-4">
      <div role="dialog" aria-modal="true" aria-label={`${entityLabel} arşiv/silme onayı`} className="w-full max-w-lg rounded-xl border border-brand-border bg-brand-surface p-6 shadow-xl">
        <h2 className="text-base font-semibold text-brand-text">{entityLabel}</h2>

        {!report ? (
          <p className="mt-4 text-sm text-brand-muted" role="status">
            Bağımlılık etkisi hesaplanıyor…
          </p>
        ) : (
          <div className="mt-4 space-y-3 text-sm">
            <div>
              <p className="font-medium text-brand-text">Yayın durumu</p>
              <p className="text-brand-muted">{report.publishedLocales.length > 0 ? "Sitede yayında." : "Sitede yayında değil."}</p>
            </div>
            <div>
              <p className="font-medium text-brand-text">Canlı public bağlantılar</p>
              {report.liveRoutes.length > 0 ? (
                <ul className="mt-1 list-disc space-y-0.5 ps-5 text-brand-muted">
                  {report.liveRoutes.map((route) => (
                    <li key={route.url}>
                      <code className="font-mono">{route.url}</code>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-brand-muted">Canlı bağlantı yok.</p>
              )}
            </div>
            {report.isLastPublishedInCollection ? (
              <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                Bu, bu içerik türünün son yayınlanan kaydı. Arşivlenirse ilgili Home bölümü ve koleksiyon sayfası artık bu içeriği göstermeyecek.
              </p>
            ) : null}
            {report.ownMediaUsageCount > 0 ? (
              <p className="text-xs text-brand-muted">Bu kayıt {report.ownMediaUsageCount} medya kullanımına sahip; kalıcı silme bunları da kaldırır.</p>
            ) : null}

            {!archived && hasImpact ? (
              <label className="flex items-start gap-2 rounded-lg border border-brand-border bg-brand-page p-3">
                <input
                  type="checkbox"
                  checked={acknowledged}
                  onChange={(e) => setAcknowledged(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-brand-border text-brand-primary focus:ring-brand-primary"
                />
                <span className="text-brand-text">Yukarıdaki etkiyi anladım ve arşivlemek istiyorum.</span>
              </label>
            ) : null}
          </div>
        )}

        {errorMessage ? (
          <p
            role="alert"
            className="mt-4 rounded-lg border border-brand-danger/30 bg-brand-danger/5 px-3 py-2 text-sm text-brand-danger"
          >
            {errorMessage}
          </p>
        ) : null}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={onDelete}
            disabled={pending}
            title={
              deleteEligible
                ? undefined
                : "Kayıt yayında: kalıcı silme sitedeki içeriği ve adresini de kaldırır."
            }
            className="rounded-lg px-3 py-2 text-sm font-semibold text-brand-danger hover:bg-brand-danger/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {deleteEligible ? "Kalıcı sil" : "Yayından kaldır ve kalıcı sil"}
          </button>
          <div className="flex items-center gap-3">
            <button type="button" onClick={onClose} className={secondaryButton}>
              Vazgeç
            </button>
            <button
              type="button"
              disabled={archiveDisabled}
              onClick={() => onArchive({ archived: !archived, acknowledgedImpact: acknowledged })}
              className={primaryButton}
            >
              {archived ? "Arşivden çıkar" : "Arşivle"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
