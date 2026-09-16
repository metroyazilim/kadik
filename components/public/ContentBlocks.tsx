import type { PublicContentBlock } from "@/lib/public-content/content-blocks";

/**
 * Renders a resolved `PublicContentBlock[]` in order - array order *is*
 * render order, matching the admin editor's dnd-kit ordering contract at
 * the block level. Only the `text` block's `html` is ever passed to
 * `dangerouslySetInnerHTML`; it was already sanitized twice (write-time in
 * `content-blocks.ts`'s `validateContentBlocks`, and again defensively at
 * this read boundary by `PublicContentReader`'s `sanitizePayloadBlockFields`)
 * before it ever reaches this component.
 */
export function ContentBlocks({ blocks }: { blocks: readonly PublicContentBlock[] }) {
  return (
    <div className="space-y-8">
      {blocks.map((block, index) => (
        <ContentBlockView key={index} block={block} />
      ))}
    </div>
  );
}

function ContentBlockView({ block }: { block: PublicContentBlock }) {
  switch (block.type) {
    case "text":
      return (
        <div
          className="whitespace-pre-wrap text-lg leading-9 text-ink [&_a]:text-brand [&_a]:underline [&_ul]:list-disc [&_ul]:ps-6"
          dangerouslySetInnerHTML={{ __html: block.html }}
        />
      );
    case "image":
      return (
        <figure>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={block.image.url} alt={block.image.altText} className="w-full object-cover" />
          {block.caption ? <figcaption className="mt-2 text-sm text-muted">{block.caption}</figcaption> : null}
        </figure>
      );
    case "kpi":
      return (
        <div className="rounded-lg border border-hairline bg-base p-7">
          {block.heading ? <p className="font-display text-lg font-bold text-ink">{block.heading}</p> : null}
          <dl className={`mt-4 grid grid-cols-2 gap-6 ${block.items.length >= 3 ? "sm:grid-cols-4" : "sm:grid-cols-3"}`}>
            {block.items.map((item, index) => (
              <div key={index}>
                <dt className="font-display text-3xl font-bold text-brand">{item.value}</dt>
                <dd className="mt-1 text-sm text-muted">{item.label}</dd>
              </div>
            ))}
          </dl>
        </div>
      );
    case "banner":
      return (
        <div className="relative overflow-hidden rounded-lg bg-ink text-white">
          {block.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={block.image.url} alt={block.image.altText} className="absolute inset-0 h-full w-full object-cover opacity-30" />
          ) : null}
          <div className="relative space-y-3 p-8">
            <p className="font-display text-2xl font-bold">{block.heading}</p>
            <p className="text-base leading-8 text-white/90">{block.text}</p>
            {block.ctaLabel && block.ctaUrl ? (
              <a href={block.ctaUrl} className="inline-flex items-center gap-2 bg-brand px-6 py-2.5 font-semibold text-ink transition hover:opacity-90">
                {block.ctaLabel}
              </a>
            ) : null}
          </div>
        </div>
      );
    case "quote":
      return (
        <blockquote className="border-s-4 border-brand ps-6">
          <p className="font-display text-xl italic leading-8 text-ink">&ldquo;{block.text}&rdquo;</p>
          {block.author ? <cite className="mt-3 block text-sm not-italic text-muted">— {block.author}</cite> : null}
        </blockquote>
      );
  }
}
