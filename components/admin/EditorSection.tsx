"use client";

import { useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ChevronDown } from "lucide-react";
import { card, cn, helpText, sectionTitle } from "./ui";
import { ToneBadge } from "./StatusBadge";

type SectionStatus = Readonly<{ label: string; tone: "success" | "warning" | "danger" | "muted" | "primary" }>;

type EditorSectionProps = Readonly<{
  id: string;
  title: string;
  description?: string;
  icon?: LucideIcon;
  status?: SectionStatus;
  defaultOpen?: boolean;
  hasError?: boolean;
  children: ReactNode;
  className?: string;
}>;

/** Accessible accordion/card section used by admin editors. */
export function EditorSection({
  id,
  title,
  description,
  icon: Icon,
  status,
  defaultOpen = false,
  hasError = false,
  children,
  className,
}: EditorSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <details id={id} className={cn(card, "group overflow-hidden", className)} open={hasError || open} onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary className="flex cursor-pointer list-none items-start justify-between gap-4 px-5 py-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-primary [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 gap-3">
          {Icon ? (
            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-brand-primary/10 text-brand-primary">
              <Icon className="size-4" aria-hidden="true" />
            </span>
          ) : null}
          <span className="min-w-0 space-y-1">
            <span className={sectionTitle}>{title}</span>
            {description ? <span className={cn(helpText, "block leading-5")}>{description}</span> : null}
            {hasError ? <span className="block text-xs font-semibold text-brand-danger">Bu bölümde düzeltilmesi gereken alan var.</span> : null}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {status ? <ToneBadge tone={status.tone} label={status.label} /> : null}
          <ChevronDown className="size-4 text-brand-muted transition-transform group-open:rotate-180" aria-hidden="true" />
        </span>
      </summary>
      <div className="border-t border-brand-border bg-brand-page/50 p-5">{children}</div>
    </details>
  );
}
