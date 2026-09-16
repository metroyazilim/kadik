import Link from "next/link";
import { cn, secondaryButton } from "./ui";

/**
 * `?page=` pagination for every admin list. Rendered as links so the
 * current page is part of the address and survives a refresh.
 */
export function Pagination({
  basePath,
  page,
  perPage,
  total,
}: {
  basePath: string;
  page: number;
  perPage: number;
  total: number;
}) {
  const lastPage = Math.max(1, Math.ceil(total / perPage));
  if (total === 0) return null;

  const first = (page - 1) * perPage + 1;
  const last = Math.min(page * perPage, total);
  const disabled = "pointer-events-none opacity-40";

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
      <p className="text-xs text-brand-muted">
        {total} kayıttan {first}–{last} arası gösteriliyor
      </p>
      {lastPage > 1 ? (
        <div className="flex items-center gap-2">
          <Link
            href={`${basePath}?page=${page - 1}`}
            aria-disabled={page <= 1 || undefined}
            className={cn(secondaryButton, page <= 1 && disabled)}
          >
            Önceki
          </Link>
          <span className="text-xs font-bold uppercase tracking-wider text-brand-muted">
            {page} / {lastPage}
          </span>
          <Link
            href={`${basePath}?page=${page + 1}`}
            aria-disabled={page >= lastPage || undefined}
            className={cn(secondaryButton, page >= lastPage && disabled)}
          >
            Sonraki
          </Link>
        </div>
      ) : null}
    </div>
  );
}
