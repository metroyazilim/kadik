"use client";

import { useState, useTransition } from "react";
import { Phone, X, Check, RotateCcw, Copy, CheckCheck } from "lucide-react";
import type { MessageStatus } from "@prisma/client";
import { ToneBadge } from "@/components/admin/StatusBadge";
import { secondaryButton } from "@/components/admin/ui";
import { telHref } from "./message-links";
import { updateMessageStatusDirectAction } from "./actions";
import type { ManagedMessage } from "@/lib/content";
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

export type MessageListItem = ManagedMessage;

type MessageSheetProps = Readonly<{
  message: MessageListItem | null;
  onClose: () => void;
  onStatusChange: (id: string, newStatus: MessageStatus, newVersion: number) => void;
}>;

export function MessageSheet({ message, onClose, onStatusChange }: MessageSheetProps) {
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (!message) return null;

  const handleSetStatus = (nextStatus: MessageStatus) => {
    setErrorMessage(null);
    startTransition(async () => {
      const res = await updateMessageStatusDirectAction(
        message.id,
        message.version,
        nextStatus,
      );
      if (res.status === "success") {
        onStatusChange(message.id, nextStatus, message.version + 1);
      } else if (res.status === "conflict") {
        setErrorMessage(`Mesaj başka bir işlemle güncellenmiş (${STATUS_LABELS[res.current]}).`);
      } else if (res.status === "error") {
        setErrorMessage(res.message);
      }
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="message-sheet-title"
      className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
    >
      {/* Backdrop click */}
      <button
        type="button"
        aria-label="Kapat"
        onClick={onClose}
        className="fixed inset-0 h-full w-full cursor-default bg-transparent"
      />

      {/* Sheet Content Panel */}
      <div className="relative z-10 flex h-full w-full max-w-xl flex-col border-l border-brand-border bg-brand-surface shadow-2xl animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-brand-border px-6 py-4 bg-brand-page/50">
          <div className="flex items-center gap-2.5">
            <h3 id="message-sheet-title" className="text-base font-bold text-brand-text">
              Mesaj Detayı
            </h3>
            <ToneBadge
              tone={STATUS_TONES[message.status]}
              label={STATUS_LABELS[message.status]}
            />
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Kapat"
            className="flex size-8 items-center justify-center rounded-sm text-brand-muted hover:bg-brand-muted-surface hover:text-brand-text transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 space-y-5 overflow-y-auto p-6">
          {errorMessage && (
            <div className="rounded-sm border border-brand-danger/30 bg-brand-danger/10 px-3.5 py-2 text-xs text-brand-danger">
              {errorMessage}
            </div>
          )}

          {/* Sender & Contact card */}
          <div className="rounded-md border border-brand-border bg-brand-page/40 p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-brand-muted">
                  Gönderen
                </p>
                <p className="mt-0.5 text-base font-bold text-brand-text">
                  {message.name}
                </p>
              </div>
              <span className="font-mono text-xs text-brand-muted">
                {new Intl.DateTimeFormat("tr-TR", {
                  dateStyle: "medium",
                  timeStyle: "short",
                }).format(new Date(message.createdAt))}
              </span>
            </div>

            <div className="mt-3 flex flex-wrap gap-4 text-xs">
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard.writeText(message.email);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                title="E-postayı kopyala"
                className="inline-flex items-center gap-1.5 font-semibold text-brand-primary hover:text-brand-primary-dark transition-colors"
              >
                {copied ? (
                  <CheckCheck className="size-3.5 text-brand-success" />
                ) : (
                  <Copy className="size-3.5" />
                )}
                <span>{message.email}</span>
                {copied && <span className="text-[10px] text-brand-success font-normal">(Kopyalandı)</span>}
              </button>
              {message.phone ? (
                <a
                  href={telHref(message.phone)}
                  dir="ltr"
                  className="inline-flex items-center gap-1.5 text-brand-muted hover:text-brand-text hover:underline"
                >
                  <Phone className="size-3.5" />
                  {message.phone}
                </a>
              ) : null}
              <span className="inline-flex items-center gap-1 font-mono uppercase text-brand-muted">
                DİL: {message.locale}
              </span>
            </div>
          </div>

          {/* Subject & Message Content */}
          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-brand-muted">
              Konu
            </p>
            <h4 className="text-sm font-bold text-brand-text">
              {message.subject || "Konu belirtilmemiş"}
            </h4>
          </div>

          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-brand-muted">
              Mesaj İçeriği
            </p>
            <div className="rounded-md border border-brand-border bg-brand-surface p-4 text-sm leading-relaxed text-brand-text whitespace-pre-wrap selection:bg-brand-primary/20">
              {message.message}
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="border-t border-brand-border bg-brand-page/60 px-6 py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {message.status === "UNREAD" ? (
              <button
                type="button"
                disabled={isPending}
                onClick={() => handleSetStatus("READ")}
                className={secondaryButton}
              >
                <Check className="size-3.5 text-brand-success" />
                {isPending ? "İşleniyor…" : "Okundu Olarak İşaretle"}
              </button>
            ) : (
              <button
                type="button"
                disabled={isPending}
                onClick={() => handleSetStatus("UNREAD")}
                className={secondaryButton}
              >
                <RotateCcw className="size-3.5 text-brand-primary" />
                {isPending ? "İşleniyor…" : "Okunmadı Olarak İşaretle"}
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(message.email);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-sm)] bg-brand-primary px-4 py-2 text-xs font-bold uppercase tracking-wider text-white transition-colors hover:bg-brand-primary-dark"
            >
              {copied ? (
                <>
                  <CheckCheck className="size-3.5" />
                  E-posta Kopyalandı
                </>
              ) : (
                <>
                  <Copy className="size-3.5" />
                  E-postayı Kopyala
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              className={secondaryButton}
            >
              Kapat
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
