"use client";

import type { Locale } from "@/lib/i18n/config";
import { cn } from "./ui";
import { ToneBadge } from "./StatusBadge";

const LOCALES: readonly Locale[] = ["tr", "en"];
const LOCALE_LABEL: Record<Locale, string> = { tr: "TR", en: "Global" };
const STATUS_LABEL: Record<string, string> = { missing: "Bu dilde yok", draft: "Kaydedildi", published: "Yayında" };
const STATUS_TONE: Record<string, "muted" | "warning" | "success"> = { missing: "muted", draft: "warning", published: "success" };

type LocaleStatusTabsProps = Readonly<{
  activeLocale: Locale;
  label: string;
  statuses: Partial<Record<Locale, string>>;
  onSelect: (locale: Locale) => void;
  /** Rendered flush right on the same row - the translation assistant lives
   * here, next to the language it produces drafts for. */
  actions?: React.ReactNode;
}>;

export function LocaleStatusTabs({ activeLocale, label, statuses, onSelect, actions }: LocaleStatusTabsProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label={label}>
      {LOCALES.map((locale) => {
        const status = statuses[locale] ?? "missing";
        const active = activeLocale === locale;
        return (
          <button
            key={locale}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onSelect(locale)}
            className={cn(
              "flex items-center gap-1.5 rounded-[var(--radius-sm)] border px-3 py-1.5 text-sm font-semibold transition-colors",
              active ? "border-brand-primary bg-brand-primary/10 text-brand-primary" : "border-brand-border bg-brand-surface text-brand-text hover:bg-brand-page",
            )}
          >
            {LOCALE_LABEL[locale]}
            <ToneBadge tone={STATUS_TONE[status] ?? "muted"} label={STATUS_LABEL[status] ?? status} />
          </button>
        );
      })}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export { LOCALES, LOCALE_LABEL, STATUS_LABEL, STATUS_TONE };
