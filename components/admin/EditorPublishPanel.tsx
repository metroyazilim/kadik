"use client";

import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { FormStatus } from "./StateSurfaces";
import { ToneBadge } from "./StatusBadge";
import { card, cn, fieldHint, primaryButton } from "./ui";

type EditorPublishPanelProps = Readonly<{
  statusLabel: string;
  statusTone: "muted" | "warning" | "success" | "danger" | "primary";
  /** Kept for call-site compatibility; the panel no longer shows versions. */
  version?: number;
  hint: string;
  isSavingDraft?: boolean;
  isPublishing: boolean;
  /** Kept for call-site compatibility; there is a single Save action. */
  canPublish?: boolean;
  onDraftClick?: () => void;
  onPublishClick: () => void;
  publishFormAction?: ButtonHTMLAttributes<HTMLButtonElement>["formAction"];
  error?: string;
  success?: string;
  extra?: ReactNode;
}>;

/** Shared side panel with the editor's single Save action (saving publishes). Must be rendered inside the owning form. */
export function EditorPublishPanel({
  statusLabel,
  statusTone,
  hint,
  isSavingDraft = false,
  isPublishing,
  onPublishClick,
  publishFormAction,
  error,
  success,
  extra,
}: EditorPublishPanelProps) {
  const saveButtonRef = useRef<HTMLButtonElement>(null);

  // Ctrl/⌘+S saves (and therefore publishes) without the browser's own
  // "save page" dialog stealing the editor session.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "s") return;
      event.preventDefault();
      saveButtonRef.current?.click();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const busy = isPublishing || isSavingDraft;
  return (
    <div className={cn(card, "space-y-4 p-5")}>
      <div className="space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-brand-muted">Durum</p>
        <div className="flex flex-wrap items-center gap-2">
          <ToneBadge tone={statusTone} label={statusLabel} />
        </div>
      </div>
      <p className={fieldHint}>{hint}</p>
      {extra}
      <button
        ref={saveButtonRef}
        type="submit"
        formAction={publishFormAction}
        onClick={onPublishClick}
        disabled={busy}
        className={cn(primaryButton, "w-full")}
      >
        {busy ? "Kaydediliyor…" : "Kaydet"}
      </button>
      <FormStatus error={error} success={success} />
    </div>
  );
}
