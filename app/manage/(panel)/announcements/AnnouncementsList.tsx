"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Pencil } from "lucide-react";
import { SortableDragHandleIcon, SortableList } from "@/components/admin/SortableList";
import { EmptyState } from "@/components/admin/StateSurfaces";
import { ToneBadge } from "@/components/admin/StatusBadge";
import { useToast } from "@/components/admin/Toast";
import { cn, iconButton, tableWrap } from "@/components/admin/ui";
import type { AdminAnnouncementRow } from "@/lib/kadik-content/collections";
import { reorderAnnouncementsAction } from "../kadik-collection-actions";

export function AnnouncementsList({ items: initialItems }: { items: readonly AdminAnnouncementRow[] }) {
  const [items, setItems] = useState(initialItems);
  const [previous, setPrevious] = useState(initialItems);
  if (previous !== initialItems) {
    setPrevious(initialItems);
    setItems(initialItems);
  }
  const [, startTransition] = useTransition();
  const { toast } = useToast();

  if (items.length === 0) return <EmptyState title="Henüz duyuru yok" description="“Yeni duyuru” ile ilk duyuruyu ekleyin." />;

  const reorder = (ids: readonly string[]) => {
    const byId = new Map(items.map((item) => [item.id, item]));
    setItems(ids.flatMap((id) => (byId.get(id) ? [byId.get(id) as AdminAnnouncementRow] : [])));
    startTransition(async () => {
      const result = await reorderAnnouncementsAction(ids);
      if (!result.ok) toast(result.message, "error");
    });
  };

  return (
    <div className={cn(tableWrap, "divide-y divide-brand-border")}>
      <SortableList
        items={items}
        onReorder={reorder}
        renderItem={(item, { setNodeRef, style, dragHandleProps }) => (
          <div ref={setNodeRef} style={style} className="flex items-center gap-3 bg-brand-surface px-4 py-3">
            <button type="button" {...dragHandleProps}>
              <SortableDragHandleIcon />
            </button>
            <div className="min-w-0 flex-1">
              <Link href={`/manage/announcements/${item.id}`} className="block truncate text-sm font-bold text-brand-text hover:text-brand-primary">
                {item.title}
              </Link>
              <p className="truncate text-xs text-brand-muted">{[item.date, item.text].filter(Boolean).join(" · ") || "—"}</p>
            </div>
            <ToneBadge tone={item.published ? "success" : "muted"} label={item.published ? "Yayında" : "Gizli"} />
            <Link href={`/manage/announcements/${item.id}`} className={iconButton} aria-label={`${item.title} düzenle`}>
              <Pencil className="size-4" aria-hidden="true" />
            </Link>
          </div>
        )}
      />
    </div>
  );
}
