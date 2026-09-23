import { ImageOff } from "lucide-react";

/** Small square preview shown at the start of a list row (portrait, cover image). */
export function RowThumbnail({ url, alt = "" }: { url?: string | null; alt?: string }) {
  if (!url) {
    return (
      <span className="flex size-12 shrink-0 items-center justify-center rounded-[var(--radius-sm)] border border-dashed border-brand-border bg-brand-page text-brand-muted" title="Görsel yok">
        <ImageOff className="size-4" aria-hidden="true" />
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt={alt} loading="lazy" className="size-12 shrink-0 rounded-[var(--radius-sm)] border border-brand-border object-cover" />
  );
}
