import "server-only";
import type { ContentBlock } from "../content-model/content-blocks";
import type { KpiItem } from "../content-model/content-blocks";
import type { ResolvedPublicMedia } from "../content-model/public-media-resolver";
import { resolvePublicImage } from "./media";

export type PublicTextBlock = Readonly<{ type: "text"; html: string }>;
export type PublicImageBlock = Readonly<{ type: "image"; image: ResolvedPublicMedia; caption: string | null }>;
export type PublicKpiBlock = Readonly<{ type: "kpi"; heading: string | null; items: readonly KpiItem[] }>;
export type PublicBannerBlock = Readonly<{
  type: "banner";
  heading: string;
  text: string;
  image: ResolvedPublicMedia | null;
  ctaLabel: string | null;
  ctaUrl: string | null;
}>;
export type PublicQuoteBlock = Readonly<{ type: "quote"; text: string; author: string | null }>;

export type PublicContentBlock = PublicTextBlock | PublicImageBlock | PublicKpiBlock | PublicBannerBlock | PublicQuoteBlock;

/**
 * Resolves a canonical (already-sanitized, already read through
 * `PublicContentReader`) `ContentBlock[]` into render-ready blocks: every
 * `MediaAsset` id becomes a `ResolvedPublicMedia` (safe placeholder on
 * missing/archived, exactly like every other public image field) so
 * `components/public/ContentBlocks.tsx` never touches an asset id or does
 * its own storage lookup. A BANNER block's optional `imageAssetId: null`
 * resolves to `image: null` (no image was ever set - a real absence, not a
 * broken reference) rather than a placeholder graphic implying one was
 * expected.
 */
export async function resolvePublicContentBlocks(blocks: readonly ContentBlock[]): Promise<readonly PublicContentBlock[]> {
  return Promise.all(
    blocks.map(async (block): Promise<PublicContentBlock> => {
      switch (block.type) {
        case "text":
          return { type: "text", html: block.html };
        case "image":
          return { type: "image", image: await resolvePublicImage(block.assetId), caption: block.caption };
        case "kpi":
          return { type: "kpi", heading: block.heading, items: block.items };
        case "banner":
          return {
            type: "banner",
            heading: block.heading,
            text: block.text,
            image: block.imageAssetId ? await resolvePublicImage(block.imageAssetId) : null,
            ctaLabel: block.ctaLabel,
            ctaUrl: block.ctaUrl,
          };
        case "quote":
          return { type: "quote", text: block.text, author: block.author };
      }
    }),
  );
}
