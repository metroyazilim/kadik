import type { ReactNode } from "react";
import { AlertTriangle, Inbox } from "lucide-react";
import { card } from "./ui";

/**
 * Empty-collection state. Distinct from `ErrorNotice` (a failed read/write)
 * and from `DatabaseNotConfigured` (the surface cannot function at all) -
 * this is "the query succeeded and returned nothing yet", per the
 * Story 1.2 state-surface contract (EXPERIENCE.md "Empty").
 */
export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className={`${card} flex flex-col items-center gap-2 px-6 py-14 text-center`}>
      <Inbox className="h-8 w-8 text-brand-muted" aria-hidden="true" />
      <p className="text-sm font-semibold text-brand-text">{title}</p>
      {description ? <p className="max-w-md text-sm text-brand-muted">{description}</p> : null}
    </div>
  );
}

/**
 * Safe, correctable error surface for a failed read (not a form submit -
 * see `FormStatus` for that). Never receives raw exception text; callers
 * pass a fixed, user-safe message.
 */
export function ErrorNotice({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div role="alert" className={`${card} flex flex-col items-start gap-2 border-brand-danger/30 bg-brand-danger/5 px-6 py-8`}>
      <div className="flex items-center gap-2 text-brand-danger">
        <AlertTriangle className="h-5 w-5" aria-hidden="true" />
        <p className="text-sm font-semibold">{title}</p>
      </div>
      {description ? <p className="text-sm text-brand-text">{description}</p> : null}
      {action}
    </div>
  );
}

type FormStatusProps = { error?: string; success?: string };

/**
 * The single status-message component every admin form uses for its
 * mutation result. `role="alert"` (error) / `role="status"` (success) are
 * what make the result programmatically announced per AC-1.2-04 and
 * AC-1.3-05 - color/icon alone never carries the meaning.
 */
export function FormStatus({ error, success }: FormStatusProps) {
  if (!error && !success) return null;
  if (error) {
    return (
      <p role="alert" className="flex items-center gap-2 rounded-lg bg-brand-danger/10 px-3 py-2 text-sm font-medium text-brand-danger">
        {error}
      </p>
    );
  }
  return (
    <p role="status" className="flex items-center gap-2 rounded-lg bg-brand-success/10 px-3 py-2 text-sm font-medium text-brand-success">
      {success}
    </p>
  );
}

/** Layout-preserving loading skeleton for route-segment placeholders. */
export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Yükleniyor" className={`${card} overflow-hidden`}>
      <div className="h-11 animate-pulse bg-brand-page" />
      <div className="divide-y divide-brand-border">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="flex items-center gap-4 px-4 py-4">
            <div className="h-4 w-1/3 animate-pulse rounded bg-brand-page" />
            <div className="h-4 w-1/6 animate-pulse rounded bg-brand-page" />
            <div className="h-4 w-1/6 animate-pulse rounded bg-brand-page" />
          </div>
        ))}
      </div>
      <span className="sr-only">Liste yükleniyor</span>
    </div>
  );
}

/** Layout-preserving loading skeleton for editor (`new`/`[id]/edit`) route segments. */
export function FormSkeleton() {
  return (
    <div role="status" aria-label="Yükleniyor" className={`${card} space-y-5 p-6`}>
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="space-y-2">
          <div className="h-3 w-24 animate-pulse rounded bg-brand-page" />
          <div className="h-10 w-full animate-pulse rounded bg-brand-page" />
        </div>
      ))}
      <span className="sr-only">Form yükleniyor</span>
    </div>
  );
}
