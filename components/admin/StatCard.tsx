import Link from "next/link";
import { cn } from "./ui";

type StatTone = "neutral" | "success" | "warning" | "accent";

const VALUE_TONE: Record<StatTone, string> = {
  neutral: "text-brand-text",
  success: "text-brand-success",
  warning: "text-brand-warning",
  accent: "text-brand-primary",
};

/**
 * Summary figure used by the overview page and by every list page's header
 * strip. Counts come from `count()` queries, never from loading the rows.
 */
export function StatCard({
  label,
  value,
  hint,
  tone = "neutral",
  href,
}: {
  label: string;
  value: number | string;
  hint?: string;
  tone?: StatTone;
  href?: string;
}) {
  const body = (
    <>
      <p className="text-xs font-bold uppercase tracking-wider text-brand-muted">{label}</p>
      <p className={cn("mt-1 text-2xl font-extrabold", VALUE_TONE[tone])}>{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-brand-muted">{hint}</p> : null}
    </>
  );

  const shell = "rounded-[var(--radius-md)] border border-brand-border bg-brand-surface p-5";

  if (href) {
    return (
      <Link href={href} className={cn(shell, "transition-colors hover:border-brand-primary/40")}>
        {body}
      </Link>
    );
  }
  return <div className={shell}>{body}</div>;
}
