"use client";

import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { FormStatus } from "./StateSurfaces";
import { ToneBadge } from "./StatusBadge";
import { card, cn, fieldHint, primaryButton, secondaryButton } from "./ui";

type EditorPublishPanelProps = Readonly<{
  statusLabel: string;
  statusTone: "muted" | "warning" | "success" | "danger" | "primary";
  version?: number;
  hint: string;
  isSavingDraft: boolean;
  isPublishing: boolean;
  canPublish: boolean;
  onDraftClick: () => void;
  onPublishClick: () => void;
  publishFormAction?: ButtonHTMLAttributes<HTMLButtonElement>["formAction"];
  error?: string;
  success?: string;
  extra?: ReactNode;
}>;

/** Shared contextual side panel for draft/publish actions. Must be rendered inside the owning form. */
export function EditorPublishPanel({
  statusLabel,
  statusTone,
  version,
  hint,
  isSavingDraft,
  isPublishing,
  canPublish,
  onDraftClick,
  onPublishClick,
  publishFormAction,
  error,
  success,
  extra,
}: EditorPublishPanelProps) {
  const draftButtonRef = useRef<HTMLButtonElement>(null);

  // Ctrl/⌘+S is the muscle-memory save: it triggers the draft save button so
  // the browser's own "save page" dialog never steals an editor session.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "s") return;
      event.preventDefault();
      draftButtonRef.current?.click();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className={cn(card, "space-y-4 p-5")}>
      <div className="space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-brand-muted">Yayın durumu</p>
        <div className="flex flex-wrap items-center gap-2">
          <ToneBadge tone={statusTone} label={statusLabel} />
          {typeof version === "number" ? <span className="text-xs text-brand-muted">v{version}</span> : null}
        </div>
      </div>
      <p className={fieldHint}>{hint}</p>
      {extra}
      <div className="flex flex-col gap-2">
        <button
          type="submit"
          formAction={publishFormAction}
          onClick={onPublishClick}
          disabled={isPublishing || isSavingDraft}
          className={primaryButton}
        >
          {isPublishing ? "Yayınlanıyor…" : "Kaydet ve yayınla"}
        </button>
        <button
          ref={draftButtonRef}
          type="submit"
          onClick={onDraftClick}
          disabled={isSavingDraft || isPublishing}
          className={secondaryButton}
        >
          {isSavingDraft ? "Kaydediliyor…" : "Kaydet"}
        </button>
        <p className={fieldHint}>Ctrl/⌘ + S yalnızca kaydeder, yayınlamaz.</p>
      </div>
      <FormStatus error={error} success={success} />
    </div>
  );
}
