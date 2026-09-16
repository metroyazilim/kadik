import type { MessageStatus } from "@prisma/client";
import Link from "next/link";
import { PageHeader } from "@/components/admin/PageHeader";
import { Pagination } from "@/components/admin/Pagination";
import { StatCard } from "@/components/admin/StatCard";
import { EmptyState } from "@/components/admin/StateSurfaces";
import { cn } from "@/components/admin/ui";
import {
  getMessages,
  MESSAGE_PAGE_SIZE,
  type MessageStatusFilter,
} from "@/lib/content";
import { prisma } from "@/lib/db";
import { messagesHref } from "./message-links";
import { MessagesTable } from "./MessagesTable";
type SearchParams = Promise<{ page?: string; status?: string }>;

const FILTERS: readonly { value: MessageStatusFilter; label: string }[] = [
  { value: "ALL", label: "Tümü" },
  { value: "UNREAD", label: "Okunmadı" },
  { value: "READ", label: "Okundu" },
  { value: "REPLIED", label: "Yanıtlandı" },
  { value: "PROCESSED", label: "İşleme Alındı" },
  { value: "ARCHIVED", label: "Arşivlendi" },
  { value: "SPAM", label: "Spam" },
];

const STATUS_LABELS: Record<MessageStatus, string> = {
  UNREAD: "Okunmadı",
  READ: "Okundu",
  REPLIED: "Yanıtlandı",
  PROCESSED: "İşleme Alındı",
  ARCHIVED: "Arşivlendi",
  SPAM: "Spam",
};

const STATUS_TONES: Record<
  MessageStatus,
  "success" | "warning" | "danger" | "muted" | "primary"
> = {
  UNREAD: "primary",
  READ: "muted",
  REPLIED: "success",
  PROCESSED: "warning",
  ARCHIVED: "muted",
  SPAM: "danger",
};

const dateFormatter = new Intl.DateTimeFormat("tr-TR", {
  dateStyle: "medium",
  timeStyle: "short",
});

function isMessageStatusFilter(
  value: string | undefined,
): value is MessageStatusFilter {
  return FILTERS.some((filter) => filter.value === value);
}

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const query = await searchParams;
  const parsedPage = Number.parseInt(query.page ?? "1", 10);
  const requestedPage =
    Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const activeStatus: MessageStatusFilter = isMessageStatusFilter(query.status)
    ? query.status
    : "ALL";

  const [list, total, unread, replied, archived] = await Promise.all([
    getMessages({ status: activeStatus, page: requestedPage }),
    prisma.message.count(),
    prisma.message.count({ where: { status: "UNREAD" } }),
    prisma.message.count({ where: { status: "REPLIED" } }),
    prisma.message.count({ where: { status: "ARCHIVED" } }),
  ]);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="Mesajlar"
        title="Gelen Kutusu"
        description="İletişim ve teklif formlarından gelen ziyaretçi mesajlarını inceleyin."
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Toplam" value={total} hint="Tüm mesajlar" />
        <StatCard
          label="Okunmadı"
          value={unread}
          hint="Yanıt bekleyen"
          tone="accent"
        />
        <StatCard
          label="Yanıtlandı"
          value={replied}
          hint="Yanıt verilen"
          tone="success"
        />
        <StatCard
          label="Arşivli"
          value={archived}
          hint="Arşive alınan"
        />
      </div>

      <nav
        aria-label="Durum filtresi"
        className="mb-4 flex flex-wrap gap-2"
      >
        {FILTERS.map((filter) => (
          <Link
            key={filter.value}
            href={messagesHref(filter.value)}
            aria-current={filter.value === activeStatus ? "page" : undefined}
            className={cn(
              "rounded-[var(--radius-sm)] border px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors",
              filter.value === activeStatus
                ? "border-brand-primary bg-brand-primary text-white"
                : "border-brand-border bg-brand-surface text-brand-muted hover:bg-brand-muted-surface hover:text-brand-text",
            )}
          >
            {filter.label}
          </Link>
        ))}
      </nav>

      {list.messages.length === 0 ? (
        <EmptyState
          title="Mesaj bulunamadı"
          description="Bu filtreyle eşleşen bir mesaj bulunmuyor."
        />
      ) : (
        <MessagesTable initialMessages={list.messages} />
      )}

      <Pagination
        basePath="/manage/messages"
        page={list.page}
        perPage={MESSAGE_PAGE_SIZE}
        total={list.total}
      />
    </div>
  );
}
