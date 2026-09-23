"use client";

import { Pencil } from "lucide-react";
import Link from "next/link";
import { useState, useTransition, type ReactNode } from "react";
import { ArchiveDeleteDialog } from "@/components/admin/ArchiveDeleteDialog";
import { RowThumbnail } from "@/components/admin/RowThumbnail";
import { SortableDragHandleIcon, SortableList } from "@/components/admin/SortableList";
import { ToneBadge } from "@/components/admin/StatusBadge";
import { STATUS_LABEL, STATUS_TONE } from "@/components/admin/record-status";
import { ADMIN_CONTENT_LOCALE } from "@/lib/i18n/config";
import { EmptyState } from "@/components/admin/StateSurfaces";
import { cn, dangerLinkButton, iconButton, tableWrap } from "@/components/admin/ui";
import type { CollectionRow } from "@/lib/content-model/collection-admin";
import type { EntityDependencyReport } from "@/lib/content-model/entity-dependency";
import type { PostPayload } from "@/lib/content-model/payload-validation";
import {
  archivePostAction,
  deletePostAction,
  getPostDependencyReportAction,
  reorderPostsAction,
} from "./actions";

const LOCALES = [ADMIN_CONTENT_LOCALE] as const;
const ROW_GRID = "grid grid-cols-[minmax(0,1fr)_110px_auto] items-center gap-3";

export function PostsListView({ rows, thumbnails = {} }: { rows: readonly CollectionRow[]; thumbnails?: Readonly<Record<string, string>> }) {
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
      void reorderPostsAction(nextOrderedIds);
    });
  };

  const openArchiveDialog = (row: CollectionRow) => {
    setArchiveTarget(row);
    setDependencyReport(null);
    setActionError(null);
    void getPostDependencyReportAction(row.entityId).then(setDependencyReport);
  };

  const handleArchive = (input: { archived: boolean; acknowledgedImpact: boolean }) => {
    if (!archiveTarget) return;
    setArchivePending(true);
    startTransition(async () => {
      const result = await archivePostAction(archiveTarget.entityId, input);
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
      const result = await deletePostAction(archiveTarget.entityId);
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
        title="Henüz yazı yok"
        description="“Yeni yazı” ile ilk kaydı oluşturun; kayıt kendi adresinde açılır."
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
          <span>Yazı</span>
          <span className="text-center">Durum</span>
          <span className="text-right">İşlem</span>
        </div>
        <div className="divide-y divide-brand-border" aria-busy={isPending}>
          <SortableList
            items={items.map((row) => ({ id: row.entityId, row }))}
            onReorder={handleReorder}
            renderItem={({ row }, { setNodeRef, style, dragHandleProps }) => (
              <div ref={setNodeRef} style={style} className="bg-brand-surface">
                <PostRow
                  row={row}
                  thumbnail={thumbnails[row.entityId]}
                  handle={
                    <button type="button" {...dragHandleProps}>
                      <SortableDragHandleIcon />
                    </button>
                  }
                  onArchive={() => openArchiveDialog(row)}
                />
              </div>
            )}
          />
        </div>
      </div>

      {archiveTarget ? (
        <ArchiveDeleteDialog
          open={archiveTarget !== null}
          onClose={() => { setArchiveTarget(null); setActionError(null); }}
          entityLabel={(archiveTarget.displayPayload as PostPayload | null)?.title ?? "Yazı"}
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

function PostRow({
  row,
  thumbnail,
  handle,
  onArchive,
}: {
  row: CollectionRow;
  thumbnail?: string;
  handle: ReactNode;
  onArchive: () => void;
}) {
  const payload = row.displayPayload as PostPayload | null;

  return (
    <div className={cn(ROW_GRID, "px-3 py-3")}>
      <div className="flex min-w-0 items-center gap-3">
        {handle}
        <RowThumbnail url={thumbnail} />
        <div className="min-w-0">
        <Link
          href={`/manage/posts/${row.entityId}`}
          className="truncate text-sm font-bold text-brand-text transition-colors hover:text-brand-primary"
        >
          {payload?.title?.trim() || "(başlıksız)"}
        </Link>
        <span className="mt-0.5 block truncate font-mono text-xs text-brand-muted">/{payload?.slug ?? "—"}</span>
        {payload?.category ? (
          <span className="mt-0.5 block truncate text-xs text-brand-muted">
            {payload.category} — {payload.author}
          </span>
        ) : null}
        {row.archived ? (
          <span className="mt-1 inline-block">
            <ToneBadge tone="danger" label="Arşivlendi" />
          </span>
        ) : null}
        </div>
      </div>
      {LOCALES.map((locale) => (
        <div key={locale} className="flex justify-center">
          <ToneBadge tone={STATUS_TONE[row.statuses[locale]]} label={STATUS_LABEL[row.statuses[locale]]} />
        </div>
      ))}
      <div className="flex items-center justify-end gap-1">
        <Link href={`/manage/posts/${row.entityId}`} className={iconButton} aria-label="Düzenle">
          <Pencil className="size-4" aria-hidden="true" />
        </Link>
        <button type="button" onClick={onArchive} className={dangerLinkButton}>
          {row.archived ? "Arşivden çıkar" : "Arşivle"}
        </button>
      </div>
    </div>
  );
}
