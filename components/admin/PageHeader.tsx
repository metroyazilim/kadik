import { ArrowLeft, Plus } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { eyebrow as eyebrowClass, primaryButton, secondaryButton } from "./ui";

type PageHeaderProps = {
  eyebrow: string;
  title: string;
  description?: string;
  /** Renders a back link above the title - used by every editor page. */
  backHref?: string;
  backLabel?: string;
  /** Primary action rendered as a link, e.g. "Yeni hizmet" → `/manage/services/new`. */
  actionHref?: string;
  actionLabel?: string;
  /** Fully custom action node, for screens whose primary control is a form
   * submit (publish, save) rather than a navigation. */
  action?: ReactNode;
  /** Extra controls rendered next to the primary action. */
  children?: ReactNode;
};
export function PageHeader({
  eyebrow,
  title,
  description,
  backHref,
  backLabel = "Listeye dön",
  actionHref,
  actionLabel,
  action,
  children,
}: PageHeaderProps) {
  return (
    <div className="mb-6 border-b border-brand-border pb-5">
      {backHref ? (
        <Link
          href={backHref}
          className="mb-3 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-brand-muted transition-colors hover:text-brand-text"
        >
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          {backLabel}
        </Link>
      ) : null}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className={eyebrowClass}>{eyebrow}</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-brand-text">{title}</h1>
          {description ? <p className="mt-1.5 max-w-2xl text-sm text-brand-muted">{description}</p> : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {children}
          {action}
          {actionHref && actionLabel ? (
            <Link href={actionHref} className={primaryButton}>
              <Plus className="size-4" aria-hidden="true" />
              {actionLabel}
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** Secondary header link, e.g. "Yayın önizlemesi" next to a primary action. */
export function HeaderLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className={secondaryButton}>
      {children}
    </Link>
  );
}
