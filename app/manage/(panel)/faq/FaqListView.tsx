"use client";

import { Pencil } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { ArchiveDeleteDialog } from "@/components/admin/ArchiveDeleteDialog";
import { SortableList } from "@/components/admin/SortableList";
import { LocaleStatusBadge, ToneBadge } from "@/components/admin/StatusBadge";
import { EmptyState } from "@/components/admin/StateSurfaces";
import { cn, dangerLinkButton, iconButton, tableWrap } from "@/components/admin/ui";
import type { EntityDependencyReport } from "@/lib/content-model/entity-dependency";
import type { CollectionRow } from "@/lib/content-model/collection-admin";
import type { FaqPayload } from "@/lib/content-model/payload-validation";
import {
  archiveFaqAction,
  deleteFaqAction,
  getFaqDependencyReportAction,
  reorderFaqsAction,
} from "./actions";

const LOCALES = ["tr", "en"] as const;
const ROW_GRID = "grid grid-cols-[minmax(0,1fr)_repeat(2,60px)_auto] items-center gap-3";

/**
 * The FAQ list table. Editing is a link to `/manage/faq/<id>`, so this
 * component holds no drawer state or client-side route refresh logic.
 */
export function FaqListView({ rows }: { rows: readonly CollectionRow[] }) {
  const [items, setItems] = useState(rows);
  const [prevRows, setPrevRows] = useState(rows);
  if (rows !== prevRows) {
    setPrevRows(rows);
    setItems(rows);
  }
  const [isPending, startTransition] = useTransition();
  const [archiveTarget, setArchiveTarget] = useState<CollectionRow | null>(null);
  const [dependencyReport, setDependencyReport] = useState<EntityDependencyReport | null>(null);
  const [archivePending, setArchivePending] = useState(false);
  // Server actions return `{ error }` on a refused delete/archive (missing
  // permission, dependency guard). Without surfacing it the dialog just
  // closed and the row stayed put, looking like nothing happened.
  const [actionError, setActionError] = useState<string | null>(null);

  const handleReorder = (nextOrderedIds: readonly string[]) => {
    const byId = new Map(items.map((item) => [item.entityId, item]));
    setItems(nextOrderedIds.map((id) => byId.get(id)).filter((row): row is CollectionRow => Boolean(row)));
    startTransition(() => {
      void reorderFaqsAction(nextOrderedIds);
    });
  };

  const openArchiveDialog = (row: CollectionRow) => {
    setArchiveTarget(row);
    setDependencyReport(null);
    setActionError(null);
    void getFaqDependencyReportAction(row.entityId).then(setDependencyReport);
  };

  const handleArchive = (input: { archived: boolean; acknowledgedImpact: boolean }) => {
    if (!archiveTarget) return;
    setArchivePending(true);
    startTransition(async () => {
      const result = await archiveFaqAction(archiveTarget.entityId, input);
      setArchivePending(false);
      if (result?.error) {
        setActionError(result.error);
        return;
      }
      setActionError(null);
      setArchiveTarget(null);
    });
  };

  const handleDelete = () => {
    if (!archiveTarget) return;
    setArchivePending(true);
    startTransition(async () => {
      const result = await deleteFaqAction(archiveTarget.entityId);
      setArchivePending(false);
      if (result?.error) {
        setActionError(result.error);
        return;
      }
      setActionError(null);
      setArchiveTarget(null);
    });
  };

  if (items.length === 0) {
    return (
      <EmptyState
        title="Henüz soru yok"
        description="“Yeni soru” ile ilk kaydı oluşturun; kayıt kendi adresinde açılır."
      />
    );
  }

  return (
    <>
      <div className={tableWrap}>
        <div
          className={cn(
            ROW_GRID,
            "border-b border-brand-border bg-brand-muted-surface/75 px-5 py-3.5 text-[10px] font-bold uppercase tracking-wider text-brand-muted",
          )}
        >
          <span>Soru</span>
          {LOCALES.map((locale) => (
            <span key={locale} className="text-center">
              {locale.toUpperCase()}
            </span>
          ))}
          <span className="text-right">İşlem</span>
        </div>
        <div className="divide-y divide-brand-border" aria-busy={isPending}>
          <SortableList
            items={items.map((row) => ({ id: row.entityId, row }))}
            onReorder={handleReorder}
            renderItem={({ row }) => <FaqRow row={row} onArchive={() => openArchiveDialog(row)} />}
          />
        </div>
      </div>

      {archiveTarget ? (
        <ArchiveDeleteDialog
          open={archiveTarget !== null}
          onClose={() => { setArchiveTarget(null); setActionError(null); }}
          entityLabel={(archiveTarget.displayPayload as FaqPayload | null)?.question ?? "Soru"}
          archived={archiveTarget.archived}
          report={dependencyReport}
          onArchive={handleArchive}
          onDelete={handleDelete}
          pending={archivePending}
          errorMessage={actionError}
        />
      ) : null}
    </>
  );
}

function FaqRow({ row, onArchive }: { row: CollectionRow; onArchive: () => void }) {
  const payload = row.displayPayload as FaqPayload | null;

  return (
    <div className={cn(ROW_GRID, "px-3 py-3")}>
      <div className="min-w-0">
        <Link
          href={`/manage/faq/${row.entityId}`}
          className="block truncate text-sm font-bold text-brand-text transition-colors hover:text-brand-primary"
        >
          {payload?.question?.trim() || "(sorusuz)"}
        </Link>
        {row.archived ? (
          <span className="mt-1 inline-block">
            <ToneBadge tone="danger" label="Arşivlendi" />
          </span>
        ) : null}
      </div>
      {LOCALES.map((locale) => (
        <div key={locale} className="flex justify-center">
          <LocaleStatusBadge locale={locale} status={row.statuses[locale]} />
        </div>
      ))}
      <div className="flex items-center justify-end gap-1">
        <Link href={`/manage/faq/${row.entityId}`} className={iconButton} aria-label="Düzenle">
          <Pencil className="size-4" aria-hidden="true" />
        </Link>
        <button type="button" onClick={onArchive} className={dangerLinkButton}>
          {row.archived ? "Arşivden çıkar" : "Arşivle"}
        </button>
      </div>
    </div>
  );
}
