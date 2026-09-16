/**
 * Shared admin className tokens.
 *
 * Every list, form, card, and button in `/manage` reads these instead of
 * inlining colours or radii. The values resolve to the CSS custom property
 * tokens defined in `app/manage/admin.css` and documented in
 * `docs/context/ui-context.md` - which is what keeps the panel visually
 * consistent and free of raw hex values.
 */

/** Joins conditional class names. Falsy entries are dropped. */
export function cn(...values: readonly (string | false | null | undefined)[]): string {
  return values.filter(Boolean).join(" ");
}

/* ---------------------------------------------------------------- Layout */

export const pageShell = "mx-auto max-w-6xl";

export const card = "rounded-[var(--radius-md)] border border-brand-border bg-brand-surface shadow-xs";

export const cardPadded = `${card} p-5`;

export const dashedCard = "rounded-[var(--radius-md)] border border-dashed border-brand-border bg-brand-surface p-12 text-center";

/* ----------------------------------------------------------------- Typography */

export const eyebrow = "text-[10px] font-bold uppercase tracking-widest text-brand-accent";

export const sectionTitle = "text-sm font-bold text-brand-text";

export const helpText = "text-xs text-brand-muted";

/* ------------------------------------------------------------------- Forms */

export const fieldLabel = "block text-xs font-bold uppercase tracking-wider text-brand-muted";

export const fieldHint = "mt-1 block text-xs font-normal text-brand-muted normal-case tracking-normal";

export const fieldInput =
  "mt-1.5 block w-full rounded-[var(--radius-sm)] border border-brand-border bg-brand-surface px-3 py-2 text-sm text-brand-text placeholder:text-brand-muted focus:border-brand-primary focus:outline-none disabled:opacity-60";

export const fieldTextarea = `${fieldInput} resize-y leading-6`;

export const checkboxInput = "h-4 w-4 rounded-[var(--radius-sm)] border-brand-border text-brand-primary focus:ring-brand-primary";

export const fieldError = "mt-1.5 rounded-[var(--radius-sm)] border border-brand-danger/30 bg-brand-danger/5 px-3 py-2 text-sm text-brand-danger";

/* ----------------------------------------------------------------- Buttons */

export const primaryButton =
  "inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-sm)] bg-brand-primary px-4 py-2 text-xs font-bold uppercase tracking-wider text-white transition-colors hover:bg-brand-primary-dark disabled:cursor-wait disabled:opacity-60";

export const secondaryButton =
  "inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-sm)] border border-brand-border bg-brand-surface px-4 py-2 text-xs font-bold uppercase tracking-wider text-brand-text transition-colors hover:bg-brand-muted-surface disabled:cursor-wait disabled:opacity-60";

export const invertButton =
  "inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-sm)] bg-brand-invert px-4 py-2 text-xs font-bold uppercase tracking-wider text-brand-on-invert transition-colors hover:bg-brand-invert-soft disabled:cursor-wait disabled:opacity-60";

export const dangerLinkButton =
  "inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-sm)] px-3 py-2 text-xs font-bold uppercase tracking-wider text-brand-danger transition-colors hover:bg-brand-danger/10 disabled:cursor-wait disabled:opacity-60";

export const iconButton =
  "flex size-8 items-center justify-center rounded-[var(--radius-sm)] text-brand-muted transition-colors hover:bg-brand-muted-surface hover:text-brand-text";

/* ------------------------------------------------------------------ Tables */

export const tableWrap = `${card} overflow-x-auto`;

export const table = "w-full text-sm";

export const tableHeadRow =
  "border-b border-brand-border bg-brand-muted-surface/75 text-left text-[10px] font-bold uppercase tracking-wider text-brand-muted";

export const tableHeadCell = "px-5 py-3.5 text-start font-bold";

export const tableBody = "divide-y divide-brand-border";

export const tableRow = "transition-colors hover:bg-brand-muted-surface/60";

export const tableCell = "px-5 py-3.5 align-middle text-sm text-brand-text";
