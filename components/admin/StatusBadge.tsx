import { cn } from "./ui";

type Tone = "success" | "warning" | "danger" | "muted" | "primary";

const TONE_CLASS: Record<Tone, string> = {
  success: "bg-brand-success/10 text-brand-success",
  warning: "bg-brand-warning/10 text-brand-warning",
  danger: "bg-brand-danger/10 text-brand-danger",
  muted: "bg-brand-muted/15 text-brand-muted",
  primary: "bg-brand-primary/10 text-brand-primary",
};

/** Published/draft pill used in list rows and editor headers. */
export function PublishBadge({ published }: { published: boolean }) {
  return <ToneBadge tone={published ? "success" : "warning"} label={published ? "Yayında" : "Kaydedildi"} />;
}

export function ToneBadge({ tone, label }: { tone: Tone; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[var(--radius-sm)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
        TONE_CLASS[tone],
      )}
    >
      {label}
    </span>
  );
}

/**
 * One locale's draft/publish state in a list row. `missing` means the
 * locale has no translation at all - distinct from an unpublished draft.
 */
export function LocaleStatusBadge({ locale, status }: { locale: string; status: "missing" | "draft" | "published" }) {
  const tone: Tone = status === "published" ? "success" : status === "draft" ? "warning" : "muted";
  return (
    <span
      className={cn(
        "inline-flex min-w-9 items-center justify-center rounded-[var(--radius-sm)] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
        TONE_CLASS[tone],
      )}
      title={
        status === "published"
          ? `${locale.toUpperCase()}: yayında`
          : status === "draft"
            ? `${locale.toUpperCase()}: kaydedildi`
            : `${locale.toUpperCase()}: içerik yok`
      }
    >
      {status === "missing" ? "—" : locale.toUpperCase()}
    </span>
  );
}
