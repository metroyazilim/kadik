"use client";

import type { MessageStatus } from "@prisma/client";
import { useActionState } from "react";
import { FormStatus } from "@/components/admin/StateSurfaces";
import { ToneBadge } from "@/components/admin/StatusBadge";
import {
  card,
  cn,
  dangerLinkButton,
  fieldInput,
  secondaryButton,
} from "@/components/admin/ui";
import type { ManagedMessage } from "@/lib/content";
import {
  archiveMessageAction,
  updateMessageStatusAction,
  type MessageActionState,
} from "./actions";

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

const STATUS_OPTIONS: readonly MessageStatus[] = [
  "UNREAD",
  "READ",
  "REPLIED",
  "PROCESSED",
  "ARCHIVED",
  "SPAM",
];

const idleState: MessageActionState = { status: "idle" };

type MessageActionView = Pick<
  ManagedMessage,
  "id" | "name" | "status" | "version"
>;

function feedback(state: MessageActionState, success: string) {
  if (state.status === "conflict") {
    return {
      error: `Bu mesaj başka bir işlemle güncellendi. Güncel durum: ${STATUS_LABELS[state.current]}. Tekrar deneyin.`,
    };
  }
  if (state.status === "error") return { error: state.message };
  if (state.status === "success") return { success };
  return {};
}

/** Interactive status controls for the standalone message detail route. */
export function MessagesPanel({ message }: { message: MessageActionView }) {
  const [statusState, statusAction, statusPending] = useActionState(
    updateMessageStatusAction.bind(null, message.id),
    idleState,
  );
  const [archiveState, archiveAction, archivePending] = useActionState(
    archiveMessageAction.bind(null, message.id),
    idleState,
  );

  return (
    <section className={cn(card, "mt-4 p-5")} aria-labelledby="message-status">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="message-status" className="text-sm font-bold text-brand-text">
            Mesaj durumu
          </h2>
          <p className="mt-1 text-xs text-brand-muted">
            Mesajı iş akışındaki güncel aşamaya taşıyın.
          </p>
        </div>
        <ToneBadge
          tone={STATUS_TONES[message.status]}
          label={STATUS_LABELS[message.status]}
        />
      </div>

      <div className="mt-4 flex flex-wrap items-start gap-3">
        <form action={statusAction} className="flex flex-wrap items-center gap-2">
          <input
            type="hidden"
            name="expectedVersion"
            value={message.version}
          />
          <label className="sr-only" htmlFor={`status-${message.id}`}>
            {message.name} için durum
          </label>
          <select
            key={`${message.status}-${message.version}`}
            id={`status-${message.id}`}
            name="nextStatus"
            defaultValue={message.status}
            className={`${fieldInput} mt-0 w-auto py-2`}
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {STATUS_LABELS[option]}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={statusPending}
            className={secondaryButton}
          >
            {statusPending ? "Uygulanıyor…" : "Durumu güncelle"}
          </button>
        </form>

        {message.status !== "ARCHIVED" ? (
          <form action={archiveAction}>
            <input
              type="hidden"
              name="expectedVersion"
              value={message.version}
            />
            <button
              type="submit"
              disabled={archivePending}
              className={dangerLinkButton}
            >
              {archivePending ? "Arşivleniyor…" : "Arşivle"}
            </button>
          </form>
        ) : null}
      </div>

      <div className="mt-3 space-y-2">
        <FormStatus
          {...feedback(statusState, "Mesaj durumu güncellendi.")}
        />
        <FormStatus {...feedback(archiveState, "Mesaj arşivlendi.")} />
      </div>
    </section>
  );
}
