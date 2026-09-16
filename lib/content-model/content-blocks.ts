import { z } from "zod";
import type { ContentLocale, Prisma } from "@prisma/client";
import { ContentModelError } from "./errors";
import { sanitizeRichHtml, stripHtmlToText, validateAndSanitizeRichText } from "./sanitization";
import {
  resolvePublicMediaReference,
  type PublicMediaAllowlist,
  type PublicMediaReference,
  type ResolvedPublicMedia,
} from "./public-media-resolver";
import {
  asRecord,
  assertClosedShape,
  isNonEmptyString,
  isNullableMediaAssetId,
  isSafeNullableCtaUrl,
  optionalPlainText,
  requirePlainText,
} from "./field-guards";

/**
 * Typed public and admin content block contract (Story 5.5 + Story 9.3).
 */
export const CONTENT_BLOCK_SCHEMA_VERSION = 1;

export const CONTENT_BLOCK_TYPES = ["text", "image", "kpi", "banner", "quote"] as const;
export type ContentBlockType = (typeof CONTENT_BLOCK_TYPES)[number];

export type TextContentBlock = Readonly<{ id: string; type: "text"; html: string }>;
export type ImageContentBlock = Readonly<{ id: string; type: "image"; assetId: string; caption: string | null }>;
export type KpiItem = Readonly<{ label: string; value: string }>;
export type KpiContentBlock = Readonly<{ id: string; type: "kpi"; heading: string | null; items: readonly KpiItem[] }>;
export type BannerContentBlock = Readonly<{
  id: string;
  type: "banner";
  heading: string;
  text: string;
  imageAssetId: string | null;
  ctaLabel: string | null;
  ctaUrl: string | null;
}>;
export type QuoteContentBlock = Readonly<{ id: string; type: "quote"; text: string; author: string | null }>;

export type ContentBlock =
  | TextContentBlock
  | ImageContentBlock
  | KpiContentBlock
  | BannerContentBlock
  | QuoteContentBlock;

const MAX_BLOCKS = 40;
const MAX_KPI_ITEMS = 8;
const MAX_BLOCK_ID_LENGTH = 64;

const TEXT_BLOCK_KEYS: ReadonlySet<string> = new Set(["id", "type", "html"]);
const IMAGE_BLOCK_KEYS: ReadonlySet<string> = new Set(["id", "type", "assetId", "caption"]);
const KPI_ITEM_KEYS: ReadonlySet<string> = new Set(["label", "value"]);
const KPI_BLOCK_KEYS: ReadonlySet<string> = new Set(["id", "type", "heading", "items"]);
const BANNER_BLOCK_KEYS: ReadonlySet<string> = new Set([
  "id",
  "type",
  "heading",
  "text",
  "imageAssetId",
  "ctaLabel",
  "ctaUrl",
]);
const QUOTE_BLOCK_KEYS: ReadonlySet<string> = new Set(["id", "type", "text", "author"]);

function validateBlockId(value: unknown, index: number): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ContentModelError("invalidInput", `Block at position ${index + 1} has an invalid id.`);
  }
  const trimmed = value.trim();
  if (trimmed.length > MAX_BLOCK_ID_LENGTH) {
    throw new ContentModelError("invalidInput", `Block id at position ${index + 1} is too long.`);
  }
  return trimmed;
}

function validateTextBlock(candidate: Record<string, unknown>, index: number): TextContentBlock {
  assertClosedShape(candidate, TEXT_BLOCK_KEYS);
  const id = validateBlockId(candidate.id, index);
  return {
    id,
    type: "text",
    html: validateAndSanitizeRichText(candidate.html, `blocks[${index}].html`, 20000),
  };
}

function validateImageBlock(candidate: Record<string, unknown>, index: number): ImageContentBlock {
  assertClosedShape(candidate, IMAGE_BLOCK_KEYS);
  const id = validateBlockId(candidate.id, index);
  const assetIdRaw = candidate.assetId;
  if (!isNullableMediaAssetId(assetIdRaw) || assetIdRaw === null) {
    throw new ContentModelError("invalidInput", `Image block at position ${index + 1} requires a media asset.`);
  }
  return {
    id,
    type: "image",
    assetId: assetIdRaw.trim(),
    caption: optionalPlainText(candidate.caption, `blocks[${index}].caption`, 300),
  };
}

function validateKpiBlock(candidate: Record<string, unknown>, index: number): KpiContentBlock {
  assertClosedShape(candidate, KPI_BLOCK_KEYS);
  const id = validateBlockId(candidate.id, index);
  const rawItems = candidate.items;
  if (!Array.isArray(rawItems) || rawItems.length === 0 || rawItems.length > MAX_KPI_ITEMS) {
    throw new ContentModelError("invalidInput", `KPI block at position ${index + 1} must have 1-${MAX_KPI_ITEMS} items.`);
  }
  const items: KpiItem[] = rawItems.map((itemCandidate, itemIndex): KpiItem => {
    const itemRecord = asRecord(itemCandidate);
    assertClosedShape(itemRecord, KPI_ITEM_KEYS);
    return {
      label: requirePlainText(itemRecord.label, `blocks[${index}].items[${itemIndex}].label`, 80),
      value: requirePlainText(itemRecord.value, `blocks[${index}].items[${itemIndex}].value`, 40),
    };
  });
  return {
    id,
    type: "kpi",
    heading: optionalPlainText(candidate.heading, `blocks[${index}].heading`, 120),
    items,
  };
}

function validateBannerBlock(candidate: Record<string, unknown>, index: number): BannerContentBlock {
  assertClosedShape(candidate, BANNER_BLOCK_KEYS);
  const id = validateBlockId(candidate.id, index);
  const imageAssetId = isNullableMediaAssetId(candidate.imageAssetId)
    ? candidate.imageAssetId === null
      ? null
      : candidate.imageAssetId.trim()
    : null;
  const ctaUrlRaw = candidate.ctaUrl;
  if (!isSafeNullableCtaUrl(ctaUrlRaw)) {
    throw new ContentModelError("invalidInput", `Banner block at position ${index + 1} has an unsafe link URL.`);
  }
  return {
    id,
    type: "banner",
    heading: requirePlainText(candidate.heading, `blocks[${index}].heading`, 160),
    text: requirePlainText(candidate.text, `blocks[${index}].text`, 600),
    imageAssetId,
    ctaLabel: optionalPlainText(candidate.ctaLabel, `blocks[${index}].ctaLabel`, 60),
    ctaUrl: ctaUrlRaw === null ? null : (ctaUrlRaw as string).trim(),
  };
}

function validateQuoteBlock(candidate: Record<string, unknown>, index: number): QuoteContentBlock {
  assertClosedShape(candidate, QUOTE_BLOCK_KEYS);
  const id = validateBlockId(candidate.id, index);
  return {
    id,
    type: "quote",
    text: requirePlainText(candidate.text, `blocks[${index}].text`, 800),
    author: optionalPlainText(candidate.author, `blocks[${index}].author`, 100),
  };
}

export function validateContentBlocks(raw: unknown, fieldName: string): readonly ContentBlock[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new ContentModelError("invalidInput", `Field '${fieldName}' must contain at least one content block.`);
  }
  if (raw.length > MAX_BLOCKS) {
    throw new ContentModelError("invalidInput", `Field '${fieldName}' exceeds the ${MAX_BLOCKS} blocks limit.`);
  }

  return raw.map((candidate, index): ContentBlock => {
    const record = asRecord(candidate);
    const type = record.type;
    switch (type) {
      case "text":
        return validateTextBlock(record, index);
      case "image":
        return validateImageBlock(record, index);
      case "kpi":
        return validateKpiBlock(record, index);
      case "banner":
        return validateBannerBlock(record, index);
      case "quote":
        return validateQuoteBlock(record, index);
      default:
        throw new ContentModelError(
          "invalidInput",
          `Block at position ${index + 1} has an unknown type '${String(type)}'.`,
        );
    }
  });
}

export function collectBlockMediaAssetIds(blocks: readonly ContentBlock[] | null | undefined): readonly string[] {
  if (!Array.isArray(blocks)) return [];
  const ids: string[] = [];
  for (const block of blocks) {
    if (block.type === "image" && block.assetId) ids.push(block.assetId);
    if (block.type === "banner" && block.imageAssetId) ids.push(block.imageAssetId);
  }
  return ids;
}

export function resanitizeContentBlocks(blocks: readonly ContentBlock[]): readonly ContentBlock[] {
  return blocks.map((block): ContentBlock => {
    if (block.type === "text") {
      return { ...block, html: sanitizeRichHtml(block.html) };
    }
    return block;
  });
}

export function sanitizePayloadBlockFields(
  payload: Prisma.JsonValue,
  blockFields: readonly string[],
): Prisma.JsonValue {
  if (blockFields.length === 0 || typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    return payload;
  }
  const record = payload as Record<string, unknown>;
  let changed = false;
  const clone = { ...record };
  for (const field of blockFields) {
    const raw = record[field];
    if (Array.isArray(raw)) {
      clone[field] = resanitizeContentBlocks(raw as readonly ContentBlock[]);
      changed = true;
    }
  }
  return (changed ? clone : payload) as Prisma.JsonValue;
}

/* =========================================================================
 * Story 5.5 Pure Public Content Block Contract & Schema Definitions
 * ========================================================================= */

const MAX_BLOCKS_PER_FIELD = 60;
const MAX_TEXT_HTML_LENGTH = 20_000;
const MAX_LABEL_LENGTH = 200;
const MAX_KPI_VALUE_LENGTH = 40;
const MAX_UNIT_LENGTH = 20;
const MAX_QUOTE_LENGTH = 2_000;
const MAX_AUTHOR_LENGTH = 200;
const MAX_ALT_LENGTH = 300;
const MAX_CAPTION_LENGTH = 500;
const MAX_HREF_LENGTH = 2_048;
const MAX_MEDIA_ASSET_ID_LENGTH = 191;

function isSafeBlockHref(url: string | null | undefined): boolean {
  if (!url) return true;
  const trimmed = url.trim();
  if (trimmed.length === 0) return true;
  const hasSafePrefix =
    trimmed.startsWith("/") ||
    trimmed.startsWith("#") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("http://") ||
    trimmed.startsWith("mailto:") ||
    trimmed.startsWith("tel:");
  if (!hasSafePrefix) return false;
  const lower = trimmed.toLowerCase();
  return !lower.includes("javascript:") && !lower.includes("data:") && !lower.includes("vbscript:");
}

const reqText = (max: number) => z.string().trim().min(1).max(max);
const optText = (max: number) => z.string().trim().max(max).nullable().optional();
const mediaAssetIdSchema = z.string().trim().min(1).max(MAX_MEDIA_ASSET_ID_LENGTH);

export const textBlockSchema = z
  .object({
    type: z.literal("TEXT"),
    html: z.string().min(1).max(MAX_TEXT_HTML_LENGTH),
  })
  .strict();

export const imageBlockSchema = z
  .object({
    type: z.literal("IMAGE"),
    mediaAssetId: mediaAssetIdSchema,
    alt: optText(MAX_ALT_LENGTH),
    caption: optText(MAX_CAPTION_LENGTH),
  })
  .strict();

const kpiTrendSchema = z.enum(["up", "down", "flat"]);

export const kpiBlockSchema = z
  .object({
    type: z.literal("KPI"),
    value: reqText(MAX_KPI_VALUE_LENGTH),
    label: reqText(MAX_LABEL_LENGTH),
    unit: optText(MAX_UNIT_LENGTH),
    trend: kpiTrendSchema.nullable().optional(),
  })
  .strict();

export const bannerBlockSchema = z
  .object({
    type: z.literal("BANNER"),
    heading: reqText(MAX_LABEL_LENGTH),
    subheading: optText(MAX_LABEL_LENGTH),
    ctaLabel: optText(MAX_LABEL_LENGTH),
    ctaHref: z
      .string()
      .trim()
      .max(MAX_HREF_LENGTH)
      .refine(isSafeBlockHref, { message: "unsafe cta href" })
      .nullable()
      .optional(),
    mediaAssetId: mediaAssetIdSchema.nullable().optional(),
  })
  .strict();

export const quoteBlockSchema = z
  .object({
    type: z.literal("QUOTE"),
    quote: reqText(MAX_QUOTE_LENGTH),
    author: optText(MAX_AUTHOR_LENGTH),
    role: optText(MAX_AUTHOR_LENGTH),
  })
  .strict();

export const contentBlockSchema = z.discriminatedUnion("type", [
  textBlockSchema,
  imageBlockSchema,
  kpiBlockSchema,
  bannerBlockSchema,
  quoteBlockSchema,
]);

export type TextBlock = z.infer<typeof textBlockSchema>;
export type ImageBlock = z.infer<typeof imageBlockSchema>;
export type KpiBlock = z.infer<typeof kpiBlockSchema>;
export type BannerBlock = z.infer<typeof bannerBlockSchema>;
export type QuoteBlock = z.infer<typeof quoteBlockSchema>;
export type ParsedContentBlock = z.infer<typeof contentBlockSchema>;

export function parseContentBlocks(raw: unknown): readonly ParsedContentBlock[] {
  if (!Array.isArray(raw)) return [];
  const accepted: ParsedContentBlock[] = [];
  for (const candidate of raw) {
    if (accepted.length >= MAX_BLOCKS_PER_FIELD) break;
    const result = contentBlockSchema.safeParse(candidate);
    if (result.success) accepted.push(result.data);
  }
  return accepted;
}

export type ContentBlockMediaLookup = ReadonlyMap<string, PublicMediaReference>;

export type RenderableTextBlock = Readonly<{ type: "TEXT"; html: string }>;

export type RenderableImageBlock = Readonly<{
  type: "IMAGE";
  media: ResolvedPublicMedia;
  caption: string | null;
}>;

export type RenderableKpiBlock = Readonly<{
  type: "KPI";
  value: string;
  label: string;
  unit: string | null;
  trend: "up" | "down" | "flat" | null;
}>;

export type RenderableBannerBlock = Readonly<{
  type: "BANNER";
  heading: string;
  subheading: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
  media: ResolvedPublicMedia | null;
}>;

export type RenderableQuoteBlock = Readonly<{
  type: "QUOTE";
  quote: string;
  author: string | null;
  role: string | null;
}>;

export type RenderableContentBlock =
  | RenderableTextBlock
  | RenderableImageBlock
  | RenderableKpiBlock
  | RenderableBannerBlock
  | RenderableQuoteBlock;

export type ResolveContentBlocksContext = Readonly<{
  mediaLookup: ContentBlockMediaLookup;
  allowedMediaHosts: PublicMediaAllowlist;
  locale?: ContentLocale;
}>;

function resolveBlockMedia(
  mediaAssetId: string | null | undefined,
  context: ResolveContentBlocksContext,
): ResolvedPublicMedia | null {
  if (!mediaAssetId) return null;
  const reference = context.mediaLookup.get(mediaAssetId) ?? { asset: null };
  return resolvePublicMediaReference(reference, context.allowedMediaHosts, { locale: context.locale });
}

export function resolvePublicContentBlocks(
  blocks: readonly ParsedContentBlock[],
  context: ResolveContentBlocksContext,
): readonly RenderableContentBlock[] {
  const resolved: RenderableContentBlock[] = [];

  for (const block of blocks) {
    switch (block.type) {
      case "TEXT": {
        const html = sanitizeRichHtml(block.html);
        if (stripHtmlToText(html).length === 0) break;
        resolved.push({ type: "TEXT", html });
        break;
      }
      case "IMAGE": {
        const resolvedMedia = resolveBlockMedia(block.mediaAssetId, context);
        const media = resolvedMedia as ResolvedPublicMedia;
        resolved.push({
          type: "IMAGE",
          media: block.alt ? { ...media, altText: block.alt } : media,
          caption: block.caption ?? null,
        });
        break;
      }
      case "KPI":
        resolved.push({
          type: "KPI",
          value: block.value,
          label: block.label,
          unit: block.unit ?? null,
          trend: block.trend ?? null,
        });
        break;
      case "BANNER":
        resolved.push({
          type: "BANNER",
          heading: block.heading,
          subheading: block.subheading ?? null,
          ctaLabel: block.ctaLabel ?? null,
          ctaHref: block.ctaHref ?? null,
          media: resolveBlockMedia(block.mediaAssetId, context),
        });
        break;
      case "QUOTE":
        resolved.push({
          type: "QUOTE",
          quote: block.quote,
          author: block.author ?? null,
          role: block.role ?? null,
        });
        break;
    }
  }

  return resolved;
}
