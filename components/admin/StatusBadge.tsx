import { cn } from "./ui";

type Tone = "success" | "warning" | "danger" | "muted" | "primary";

const TONE_CLASS: Record<Tone, string> = {
  success: "bg-brand-success/10 text-brand-success",
  warning: "bg-brand-warning/10 text-brand-warning",
  danger: "bg-brand-danger/10 text-brand-danger",
  muted: "bg-brand-muted/15 text-brand-muted",
  primary: "bg-brand-primary/10 text-brand-primary",
};

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

