"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail, Pencil } from "lucide-react";
import type { MessageStatus } from "@prisma/client";
import { ToneBadge } from "@/components/admin/StatusBadge";
import {
  cn,
  iconButton,
  table,
  tableBody,
  tableCell,
  tableHeadCell,
  tableHeadRow,
  tableRow,
  tableWrap,
} from "@/components/admin/ui";
import { mailtoHref } from "./message-links";
import { MessageSheet, type MessageListItem } from "./MessageSheet";
import { updateMessageStatusDirectAction } from "./actions";

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

export function MessagesTable({
  initialMessages,
}: {
  initialMessages: readonly MessageListItem[];
}) {
  const [messages, setMessages] = useState<readonly MessageListItem[]>(initialMessages);
  const [activeMessage, setActiveMessage] = useState<MessageListItem | null>(null);
  const handleOpenMessage = (msg: MessageListItem) => {
    setActiveMessage(msg);

    // Auto-mark as READ if currently UNREAD
    if (msg.status === "UNREAD") {
      // Optimistic update
      setMessages((prev) =>
        prev.map((item) =>
          item.id === msg.id ? { ...item, status: "READ" as MessageStatus } : item,
        ),
      );
      setActiveMessage((current) => (current ? { ...current, status: "READ" } : null));

      // Trigger server action in background
      void updateMessageStatusDirectAction(msg.id, msg.version, "READ").then((res) => {
        if (res.status === "success") {
          setMessages((prev) =>
            prev.map((item) =>
              item.id === msg.id ? { ...item, version: item.version + 1 } : item,
            ),
          );
          setActiveMessage((current) =>
            current && current.id === msg.id
              ? { ...current, version: current.version + 1 }
              : current,
          );
        }
      });
    }
  };

  const handleStatusChange = (
    id: string,
    newStatus: MessageStatus,
    newVersion: number,
  ) => {
    setMessages((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, status: newStatus, version: newVersion } : item,
      ),
    );
    setActiveMessage((current) =>
      current && current.id === id
        ? { ...current, status: newStatus, version: newVersion }
        : current,
    );
  };

  return (
    <>
      <div className={tableWrap}>
        <table className={table}>
          <thead>
            <tr className={tableHeadRow}>
              <th scope="col" className={tableHeadCell}>
                Gönderen
              </th>
              <th scope="col" className={tableHeadCell}>
                Konu
              </th>
              <th scope="col" className={tableHeadCell}>
                Dil
              </th>
              <th scope="col" className={tableHeadCell}>
                Tarih
              </th>
              <th scope="col" className={tableHeadCell}>
                Durum
              </th>
              <th scope="col" className={tableHeadCell}>
                Detay
              </th>
            </tr>
          </thead>
          <tbody className={tableBody}>
            {messages.map((message) => {
              const isUnread = message.status === "UNREAD";

              return (
                <tr
                  key={message.id}
                  onClick={() => handleOpenMessage(message)}
                  className={cn(
                    tableRow,
                    "cursor-pointer select-none transition-colors",
                    isUnread
                      ? "bg-brand-primary/5 font-semibold hover:bg-brand-primary/10"
                      : "hover:bg-brand-muted-surface/70",
                  )}
                >
                  <td className={tableCell}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenMessage(message);
                      }}
                      className={cn(
                        "text-left font-bold transition-colors hover:text-brand-primary",
                        isUnread ? "text-brand-primary" : "text-brand-text",
                      )}
                    >
                      {message.name}
                    </button>
                  </td>
                  <td className={`${tableCell} max-w-sm`}>
                    <span className="line-clamp-2 text-brand-muted hover:text-brand-text transition-colors">
                      {message.subject || "—"}
                    </span>
                  </td>
                  <td className={`${tableCell} uppercase text-brand-muted font-mono text-xs`}>
                    {message.locale}
                  </td>
                  <td className={`${tableCell} whitespace-nowrap text-brand-muted text-xs font-mono`}>
                    {dateFormatter.format(new Date(message.createdAt))}
                  </td>
                  <td className={tableCell}>
                    <ToneBadge
                      tone={STATUS_TONES[message.status]}
                      label={STATUS_LABELS[message.status]}
                    />
                  </td>
                  <td className={tableCell}>
                    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => handleOpenMessage(message)}
                        className={iconButton}
                        title="Mesajı hızlı incele (Sheet)"
                        aria-label={`${message.name} mesajını incele`}
                      >
                        <Mail className="size-4" aria-hidden="true" />
                      </button>
                      <Link
                        href={`/manage/messages/${message.id}`}
                        className={iconButton}
                        title="Tam sayfa aç"
                        aria-label={`${message.name} mesajını ayrı sayfada aç`}
                      >
                        <Pencil className="size-3.5" aria-hidden="true" />
                      </Link>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Slide-over sheet */}
      <MessageSheet
        message={activeMessage}
        onClose={() => setActiveMessage(null)}
        onStatusChange={handleStatusChange}
      />
    </>
  );
}
