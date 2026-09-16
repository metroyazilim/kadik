// Public renderer for the typed content block contract (Story 5.5).
// Every block already arrived through `resolvePublicContentBlocks` -
// TEXT already sanitized, IMAGE already resolved to a verified/fallback
// MediaAsset URL, KPI/BANNER/QUOTE already shape-validated - so this
// component never re-validates, it only lays each block out. TEXT is the
// only block type ever rendered through `dangerouslySetInnerHTML`; every
// other type renders exclusively from typed, already-safe fields.
import type {
  RenderableBannerBlock,
  RenderableContentBlock,
  RenderableImageBlock,
  RenderableKpiBlock,
  RenderableQuoteBlock,
  RenderableTextBlock,
} from "@/lib/content-model/content-blocks";

function TextBlockView({ block }: { block: RenderableTextBlock }) {
  return (
    <div
      className="max-w-none leading-[28px] text-muted [&_a]:text-brand [&_a]:underline [&_li]:ms-5 [&_ol]:list-decimal [&_strong]:font-bold [&_ul]:list-disc"
      dangerouslySetInnerHTML={{ __html: block.html }}
    />
  );
}

function ImageBlockView({ block }: { block: RenderableImageBlock }) {
  return (
    <figure>
      <img
        src={block.media.url}
        alt={block.media.altText}
        width={block.media.width ?? undefined}
        height={block.media.height ?? undefined}
        className="w-full rounded-[15px] object-cover"
      />
      {block.caption ? <figcaption className="mt-2 text-sm text-muted">{block.caption}</figcaption> : null}
    </figure>
  );
}

function KpiBlockView({ block }: { block: RenderableKpiBlock }) {
  const trendGlyph = block.trend === "up" ? "\u25B2" : block.trend === "down" ? "\u25BC" : null;
  const trendClassName = block.trend === "up" ? "text-emerald-600" : "text-red-600";
  return (
    <div className="rounded-[15px] bg-base p-6 text-center shadow-[0_4px_25px_0_rgba(56,75,255,0.08)]">
      <p className="font-display text-[40px] font-bold leading-[50px] text-base">
        {block.value}
        {block.unit ? <span className="ms-1 text-[20px] font-semibold">{block.unit}</span> : null}
        {trendGlyph ? <span className={`ms-1 ${trendClassName}`}>{trendGlyph}</span> : null}
      </p>
      <p className="mt-1 leading-[28px] text-muted">{block.label}</p>
    </div>
  );
}

function BannerBlockView({ block }: { block: RenderableBannerBlock }) {
  const backgroundStyle = block.media ? { backgroundImage: `url(${block.media.url})` } : undefined;
  return (
    <div
      className="relative overflow-hidden rounded-[15px] bg-ink bg-cover bg-center p-10 text-center text-base"
      style={backgroundStyle}
    >
      {block.media ? <div aria-hidden className="absolute inset-0 bg-ink/70" /> : null}
      <div className="relative">
        <h3 className="font-display text-[32px] font-bold leading-[42px]">{block.heading}</h3>
        {block.subheading ? <p className="mt-2 leading-[28px] text-base/80">{block.subheading}</p> : null}
        {block.ctaHref && block.ctaLabel ? (
          <a
            href={block.ctaHref}
            className="mt-6 inline-block rounded-full bg-brand px-8 py-3 font-semibold text-base transition-colors duration-300 hover:bg-brand/90"
          >
            {block.ctaLabel}
          </a>
        ) : null}
      </div>
    </div>
  );
}

function QuoteBlockView({ block }: { block: RenderableQuoteBlock }) {
  return (
    <figure className="rounded-[15px] bg-base p-10 shadow-[0_4px_25px_0_rgba(56,75,255,0.08)]">
      <blockquote className="leading-[28px] text-muted">&ldquo;{block.quote}&rdquo;</blockquote>
      {block.author || block.role ? (
        <figcaption className="mt-4">
          {block.author ? <span className="font-display font-bold text-ink">{block.author}</span> : null}
          {block.role ? <span className="ms-2 text-muted">{block.role}</span> : null}
        </figcaption>
      ) : null}
    </figure>
  );
}

export default function ContentBlocks({ blocks }: { blocks: readonly RenderableContentBlock[] }) {
  if (blocks.length === 0) return null;
  return (
    <div className="flex flex-col gap-8">
      {blocks.map((block, index) => {
        switch (block.type) {
          case "TEXT":
            return <TextBlockView key={index} block={block} />;
          case "IMAGE":
            return <ImageBlockView key={index} block={block} />;
          case "KPI":
            return <KpiBlockView key={index} block={block} />;
          case "BANNER":
            return <BannerBlockView key={index} block={block} />;
          case "QUOTE":
            return <QuoteBlockView key={index} block={block} />;
        }
      })}
    </div>
  );
}
