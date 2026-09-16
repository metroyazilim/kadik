import { z } from "zod";
import type { HomeSectionKey } from "./home-section-registry";
import { HOME_SECTION_KEYS, HOME_SECTION_LABELS } from "./home-section-registry";
import { ContentModelError } from "./errors";
import { sanitizeRichHtml, stripHtmlToText } from "./sanitization";

/**
 * Home section revisions carry locale-scoped typed blocks plus the Part
 * configuration edited directly in the Home accordion. Legacy registry
 * keys and addable `ReusableSection` instances share the same validation
 * entry point; a reusable section's content type selects its template key,
 * while its own id remains the stable placement identity.
 *
 * `HOME_SECTION_SCHEMA_VERSION` gates every read/write.
 *
 * Block payload shapes (TEXT/IMAGE/KPI/BANNER/QUOTE) match AD-10's adopted
 * discriminated union field-for-field (`{html}` / `{assetId,altText}` /
 * `{label,value,supportingText}` / `{title,body,cta,mediaAssetId}` /
 * `{quote,source,mediaAssetId}`) so a later migration to AD-10's dedicated
 * `ContentBlock` table (Epic 9's own "block model/validation" story) is a
 * storage-representation change only, never a payload-shape break. What
 * this slice does NOT implement is AD-10's relational `ContentBlock` table
 * itself (revision-owned rows with a cross-revision-stable `blockId`) or
 * FR-17's cross-cutting `/manage?panel=` workspace shell for every entity -
 * both are explicitly Epic 9's own backlog stories, out of this Home-lane
 * correction's scope. Blocks stay embedded as `{blocks: HomeBlock[]}` JSON
 * inside the existing `ContentTranslationRevision.payload` (AD-2/AD-3),
 * reusing `saveDraft`/`publish` completely unmodified. A `visible` flag per
 * block is this module's own additive extension beyond AD-10 (which has no
 * such flag) - it satisfies this story's explicit visibility-toggle
 * requirement without altering AD-10's payload union shapes.
 */

export const HOME_SECTION_SCHEMA_VERSION = 1;

export const HOME_BLOCK_TYPES = ["text", "image", "kpi", "banner", "quote"] as const;
export type HomeBlockType = (typeof HOME_BLOCK_TYPES)[number];

/** Turkish labels for the "Blok ekle" type picker. */
export const HOME_BLOCK_TYPE_LABELS: Readonly<Record<HomeBlockType, string>> = {
  text: "Metin",
  image: "Görsel",
  kpi: "İstatistik (KPI)",
  banner: "Banner",
  quote: "Alıntı",
};

const MAX_BLOCKS_PER_SECTION = 40;
const MAX_RICH_TEXT_LENGTH = 4000;

/** Same "no arbitrary scheme" discipline `payload-validation.ts`'s
 * `isSafeNullableCtaUrl` already enforces for other content types, applied
 * locally here (Home's own schema module, not a cross-import) to a CTA
 * href: empty, a site-relative path, or an absolute http(s) URL - never
 * `javascript:`/`data:`/any other scheme. */
function isSafeOptionalUrl(trimmed: string): boolean {
  if (trimmed === "" || trimmed.startsWith("/") || trimmed.startsWith("#")) return true;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/** A phone/e-mail CTA additionally accepts `tel:`/`mailto:` - the About
 * part renders it as a dial link, where an http(s)-only rule is wrong. */
function isSafeContactHref(trimmed: string): boolean {
  if (isSafeOptionalUrl(trimmed)) return true;
  return /^(tel|mailto):[^\s]+$/i.test(trimmed);
}

const blockIdField = z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/, "Geçersiz blok kimliği.");

function requiredRichTextField(maxTextLength: number) {
  return z
    .string()
    .max(maxTextLength * 6)
    .transform((raw, ctx) => {
      const clean = sanitizeRichHtml(raw);
      const text = stripHtmlToText(clean).trim();
      if (text.length === 0) {
        ctx.addIssue({ code: "custom", message: "Bu alan boş olamaz." });
        return z.NEVER;
      }
      if (text.length > maxTextLength) {
        ctx.addIssue({ code: "custom", message: `En fazla ${maxTextLength} karakter olmalı.` });
        return z.NEVER;
      }
      return clean;
    });
}

function optionalRichTextField(maxTextLength: number) {
  return z
    .string()
    .max(maxTextLength * 6)
    .transform((raw, ctx) => {
      const clean = sanitizeRichHtml(raw);
      const text = stripHtmlToText(clean).trim();
      if (text.length > maxTextLength) {
        ctx.addIssue({ code: "custom", message: `En fazla ${maxTextLength} karakter olmalı.` });
        return z.NEVER;
      }
      return clean;
    })
    .default("");
}

function requiredPlainTextField(maxLength: number) {
  return z.string().transform((raw, ctx) => {
    const text = stripHtmlToText(raw).trim();
    if (text.length === 0) {
      ctx.addIssue({ code: "custom", message: "Bu alan boş olamaz." });
      return z.NEVER;
    }
    if (text.length > maxLength) {
      ctx.addIssue({ code: "custom", message: `En fazla ${maxLength} karakter olmalı.` });
      return z.NEVER;
    }
    return text;
  });
}

function optionalPlainTextField(maxLength: number) {
  return z
    .string()
    .transform((raw, ctx) => {
      const text = stripHtmlToText(raw).trim();
      if (text.length > maxLength) {
        ctx.addIssue({ code: "custom", message: `En fazla ${maxLength} karakter olmalı.` });
        return z.NEVER;
      }
      return text;
    })
    .default("");
}

/** Matches AD-10's `assetId`/`mediaAssetId` fields and Story 3.1's
 * established `imageAssetId` convention (Service/Product/etc.): a Home
 * block never stores a raw image URL, only a `MediaAsset.id` - the actual
 * URL is resolved from the current, live `MediaAsset` row wherever a block
 * is rendered (admin editor, preview, public page), never denormalized
 * into the stored payload. Never required - an admin may add an
 * IMAGE/BANNER/QUOTE block before picking media; a `null` assetId is a
 * "missing" preflight issue (`inspectHomeSectionBlocks`), never a
 * schema-validation failure. */
function optionalAssetIdField() {
  return z.string().min(1).max(64).nullable().default(null);
}

function optionalSafeUrlField() {
  return z
    .string()
    .transform((raw, ctx) => {
      const trimmed = raw.trim();
      if (trimmed.length > 2048) {
        ctx.addIssue({ code: "custom", message: "En fazla 2048 karakter olmalı." });
        return z.NEVER;
      }
      if (!isSafeOptionalUrl(trimmed)) {
        ctx.addIssue({ code: "custom", message: "Geçersiz bağlantı." });
        return z.NEVER;
      }
      return trimmed;
    })
    .default("");
}

/* =========================================================================
   Block schemas - one per HOME_BLOCK_TYPES entry, field shapes matching
   AD-10's adopted discriminated union.
   ========================================================================= */

export const homeTextBlockSchema = z
  .object({
    id: blockIdField,
    type: z.literal("text"),
    visible: z.boolean(),
    html: requiredRichTextField(MAX_RICH_TEXT_LENGTH),
  })
  .strict();
export type HomeTextBlock = z.infer<typeof homeTextBlockSchema>;

export const homeImageBlockSchema = z
  .object({
    id: blockIdField,
    type: z.literal("image"),
    visible: z.boolean(),
    assetId: optionalAssetIdField(),
    altText: optionalPlainTextField(200),
  })
  .strict();
export type HomeImageBlock = z.infer<typeof homeImageBlockSchema>;

export const homeKpiBlockSchema = z
  .object({
    id: blockIdField,
    type: z.literal("kpi"),
    visible: z.boolean(),
    label: requiredPlainTextField(120),
    value: requiredPlainTextField(40),
    supportingText: optionalPlainTextField(160),
  })
  .strict();
export type HomeKpiBlock = z.infer<typeof homeKpiBlockSchema>;

const homeCtaSchema = z
  .object({
    label: requiredPlainTextField(80),
    href: z
      .string()
      .transform((raw, ctx) => {
        const trimmed = raw.trim();
        if (!isSafeOptionalUrl(trimmed) || trimmed === "") {
          ctx.addIssue({ code: "custom", message: "Geçersiz bağlantı." });
          return z.NEVER;
        }
        return trimmed;
      }),
  })
  .strict();

export const homeBannerBlockSchema = z
  .object({
    id: blockIdField,
    type: z.literal("banner"),
    visible: z.boolean(),
    title: requiredPlainTextField(200),
    body: optionalRichTextField(MAX_RICH_TEXT_LENGTH),
    cta: homeCtaSchema.nullable().default(null),
    mediaAssetId: optionalAssetIdField(),
  })
  .strict();
export type HomeBannerBlock = z.infer<typeof homeBannerBlockSchema>;

export const homeQuoteBlockSchema = z
  .object({
    id: blockIdField,
    type: z.literal("quote"),
    visible: z.boolean(),
    quote: requiredPlainTextField(1000),
    source: optionalPlainTextField(160),
    mediaAssetId: optionalAssetIdField(),
  })
  .strict();
export type HomeQuoteBlock = z.infer<typeof homeQuoteBlockSchema>;

export const homeBlockSchema = z.discriminatedUnion("type", [
  homeTextBlockSchema,
  homeImageBlockSchema,
  homeKpiBlockSchema,
  homeBannerBlockSchema,
  homeQuoteBlockSchema,
]);
export type HomeBlock = z.infer<typeof homeBlockSchema>;

/** The one payload shape every Home section key validates against (AC-
 * FR18-02, AD-9's "no per-lane bespoke composer" rule applied within Epic 2
 * itself). At least one block is required - an enabled section with zero
 * blocks would otherwise need its own "empty but valid" renderability
 * branch, which AD-7 already forbids in spirit (a visible section with
 * nothing to show must not render); requiring >=1 block keeps that state
 * entirely out of reach at the schema level instead. */
/** The reusable block types a section slot can be filled with. A section's
 * registry key is only its slot identity - `partType` is what decides which
 * Part actually renders there, so "hizmetler" is a name the admin chose,
 * never a hardcoded binding to the service collection. */
export const HOME_PART_TYPES = [
  "collection",
  "banner",
  "kpi",
  "hero",
  "about-split",
  "testimonials",
  "logo-marquee",
  "text-marquee",
  "process-steps",
  "rich-text",
] as const;
export type HomePartType = (typeof HOME_PART_TYPES)[number];

/** Which managed collection a `collection` part lists. */
export const HOME_COLLECTION_SOURCES = [
  "services",
  "products",
  "projects",
  "team",
  "posts",
  "faq",
] as const;
export type HomeCollectionSource = (typeof HOME_COLLECTION_SOURCES)[number];

export const homeWidgetConfigSchema = z
  .object({
    partType: z.enum(HOME_PART_TYPES).default("collection"),
    source: z.enum(HOME_COLLECTION_SOURCES).default("services"),
    /** `latest` = newest first, `manual` = the admin's explicit id list,
     * `category` = every record whose category matches `categories`. */
    selectionMode: z.enum(["latest", "manual", "category"]).default("latest"),
    categories: z.array(z.string()).default([]),
    subtitle: z.string().max(200).default(""),
    title: z.string().max(300).default(""),
    titleAccent: z.string().max(300).default(""),
    description: z.string().max(2000).default(""),
    imageAlt: z.string().max(300).default(""),
    heroVariant: z.enum(["wave", "flat"]).default("wave"),
    textAlign: z.enum(["start", "center"]).default("start"),
    primaryCtaLabel: z.string().max(120).default(""),
    primaryCtaHref: z.string().max(500).refine(isSafeOptionalUrl, "Geçersiz bağlantı.").default(""),
    secondaryCtaLabel: z.string().max(120).default(""),
    secondaryCtaHref: z.string().max(500).refine(isSafeOptionalUrl, "Geçersiz bağlantı.").default(""),
    layout: z.enum(["grid", "carousel"]).default("grid"),
    columns: z.enum(["2", "3", "4"]).default("4"),
    kpiVariant: z.enum(["counter-grid", "split-card", "inline-badge"]).default("counter-grid"),
    checklist: z.array(z.string().max(240)).max(8).default([]),
    statValue: z.string().max(80).default(""),
    statLabel: z.string().max(160).default(""),
    phoneLabel: z.string().max(120).default(""),
    phoneNumber: z.string().max(80).default(""),
    phoneHref: z.string().max(500).refine(isSafeContactHref, "Geçersiz bağlantı.").default(""),
    itemCtaLabel: z.string().max(120).default(""),
    processItems: z
      .array(
        z.object({
          title: z.string().max(160),
          text: z.string().max(500),
          iconAssetId: z.string().nullable().default(null),
        }),
      )
      .max(8)
      .default([]),
    testimonialItems: z
      .array(
        z.object({
          name: z.string().max(160),
          role: z.string().max(160),
          quote: z.string().max(1000),
          avatarAssetId: z.string().nullable().default(null),
        }),
      )
      .max(8)
      .default([]),
    logoItems: z
      .array(
        z.object({
          assetId: z.string().nullable().default(null),
          altText: z.string().max(160).default(""),
          /** Optional tile colour behind a logo - only a literal `#rgb`/
           * `#rrggbb` value, never a free-form CSS string, so the stored
           * value can never smuggle a url()/expression into a style
           * attribute. Empty means "no tile, inherit the section". */
          bgColor: z
            .string()
            .regex(/^(#[0-9a-fA-F]{3}|#[0-9a-fA-F]{6})?$/, "Geçersiz renk.")
            .max(7)
            .default(""),
        }),
      )
      .max(48)
      .default([]),
    kpiItems: z
      .array(
        z.object({
          value: z.string().max(40),
          label: z.string().max(120),
          supportingText: z.string().max(300).default(""),
          iconAssetId: z.string().nullable().default(null),
        }),
      )
      .max(8)
      .default([]),
    selectedEntityIds: z.array(z.string()).default([]),
    /** Free-form word/logo list for the marquee part types. */
    marqueeItems: z.array(z.string()).default([]),
    limit: z.number().int().min(1).max(20).default(4),
    bgImage: z.string().nullable().default(null),
    bgImageAssetId: z.string().nullable().default(null),
  })
  .partial();

export type HomeWidgetConfig = z.infer<typeof homeWidgetConfigSchema>;

export const homeSectionPayloadSchema = z
  .object({
    blocks: z
      .array(homeBlockSchema)
      .max(MAX_BLOCKS_PER_SECTION, `En fazla ${MAX_BLOCKS_PER_SECTION} blok eklenebilir.`)
      .default([]),
    widget: homeWidgetConfigSchema.optional().default({}),
  })
  .strict()
  .superRefine((payload, ctx) => {
    const seen = new Set<string>();
    payload.blocks.forEach((block, index) => {
      if (seen.has(block.id)) {
        ctx.addIssue({
          code: "custom",
          message: "Blok kimlikleri benzersiz olmalı.",
          path: ["blocks", index, "id"],
        });
      }
      seen.add(block.id);
    });
  });
export type HomeSectionBlocksPayload = z.infer<typeof homeSectionPayloadSchema>;

/** Every registry key shares the identical schema - kept as a per-key map
 * (rather than one bare constant) so `payload-validation.ts`'s existing
 * `HOME_SECTION_SCHEMAS[key]` lookup convention and `HomeSectionPayloadMap`
 * generic indexing keep working unchanged. */
export const HOME_SECTION_SCHEMAS: Record<HomeSectionKey, typeof homeSectionPayloadSchema> =
  Object.fromEntries(HOME_SECTION_KEYS.map((key) => [key, homeSectionPayloadSchema])) as Record<
    HomeSectionKey,
    typeof homeSectionPayloadSchema
  >;

export type HomeSectionPayloadMap = Record<HomeSectionKey, HomeSectionBlocksPayload>;

/**
 * One default TEXT block per key, naming the section so a freshly
 * bootstrapped registry row (Story 2.1's `ensureHomeSectionRegistry`) has
 * placeholder content an admin can see and replace, rather than an
 * inherently-invalid empty draft.
 */
export function defaultHomeSectionPayload<K extends HomeSectionKey>(key: K): HomeSectionPayloadMap[K] {
  const payload: HomeSectionBlocksPayload = {
    blocks: [
      {
        id: "block-1",
        type: "text",
        visible: true,
        html: `<p>${HOME_SECTION_LABELS[key]} içeriğini düzenlemek için bu bloğu kullanın.</p>`,
      },
    ],
    widget: {},
  };
  return payload as HomeSectionPayloadMap[K];
}

/** Factory for the "Blok ekle" type picker - a fresh, intentionally-empty
 * block of the chosen type. Required fields are left blank; the admin fills
 * them before saving (an empty required field fails `validateHomeSectionPayload`
 * with a field-identifying message, matching every other content form's
 * save-time validation). */
export function createDefaultHomeBlock(type: HomeBlockType, id: string): HomeBlock {
  switch (type) {
    case "text":
      return { id, type, visible: true, html: "" };
    case "image":
      return { id, type, visible: true, assetId: null, altText: "" };
    case "kpi":
      return { id, type, visible: true, label: "", value: "", supportingText: "" };
    case "banner":
      return { id, type, visible: true, title: "", body: "", cta: null, mediaAssetId: null };
    case "quote":
      return { id, type, visible: true, quote: "", source: "", mediaAssetId: null };
  }
}

/**
 * Validates and canonicalizes any HomeSection payload: runs sanitization on
 * every rich-text block field, enforces block-id uniqueness, and throws
 * `ContentModelError("invalidInput", ...)` on any mismatch. `key` is part of
 * the signature (matching every prior version of this function and
 * `payload-validation.ts`'s dispatch call) even though every key now
 * resolves to the same schema - a future key-specific constraint has
 * exactly one place to attach without changing this function's callers.
 */
export function validateHomeSectionPayload<K extends HomeSectionKey>(
  key: K,
  schemaVersion: number,
  payload: unknown,
): HomeSectionPayloadMap[K] {
  void key;
  if (schemaVersion !== HOME_SECTION_SCHEMA_VERSION) {
    throw new ContentModelError(
      "invalidInput",
      `Unsupported Home section schema version: ${schemaVersion}.`,
    );
  }
  const result = homeSectionPayloadSchema.safeParse(payload);
  if (!result.success) {
    const issue = result.error.issues[0];
    const location = issue?.path?.length ? `${issue.path.join(".")}: ` : "";
    throw new ContentModelError(
      "invalidInput",
      `${location}${issue?.message ?? "Geçersiz Home section içeriği."}`,
    );
  }
  return result.data as HomeSectionPayloadMap[K];
}

/**
 * Every `MediaAsset.id` a validated payload's blocks reference - the set
 * `assertMediaAssetsExist` verifies before a save/publish writes, and
 * `syncFieldMediaUsage` reconciles into `MediaUsage` rows after it succeeds
 * (mirroring Story 3.1's `ServiceEditorForm`/`saveServiceDraftAction`
 * pattern exactly, `imageAssetId` field for field, applied per block
 * instead of once per entity).
 */
export function homeSectionMediaAssetIds(payload: HomeSectionBlocksPayload): readonly string[] {
  const ids: string[] = [];
  if (payload.widget.bgImageAssetId) ids.push(payload.widget.bgImageAssetId);
  for (const item of payload.widget.processItems ?? []) {
    if (item.iconAssetId) ids.push(item.iconAssetId);
  }
  for (const item of payload.widget.kpiItems ?? []) {
    if (item.iconAssetId) ids.push(item.iconAssetId);
  }
  for (const item of payload.widget.testimonialItems ?? []) {
    if (item.avatarAssetId) ids.push(item.avatarAssetId);
  }
  for (const item of payload.widget.logoItems ?? []) {
    if (item.assetId) ids.push(item.assetId);
  }
  for (const block of payload.blocks) {
    if (block.type === "image" && block.assetId) ids.push(block.assetId);
    else if (block.type === "banner" && block.mediaAssetId) ids.push(block.mediaAssetId);
    else if (block.type === "quote" && block.mediaAssetId) ids.push(block.mediaAssetId);
  }
  return ids;
}

/**
 * Key-agnostic, fail-safe block extraction for the public read boundary
 * (Story 2.5): every registry key shares the identical schema, so no
 * `HomeSectionKey` is needed to parse a payload's blocks. Returns an empty
 * array (never throws) on anything that does not parse - the public
 * renderer's own contract is "an unresolvable section renders nothing"
 * (AD-7), never a 500.
 */
export function parseHomeBlocksForRender(payload: unknown): readonly HomeBlock[] {
  const result = homeSectionPayloadSchema.safeParse(payload);
  return result.success ? result.data.blocks : [];
}

/* =========================================================================
   Preflight block-issue inspection (Story 2.4 correction) - pure helpers,
   no Prisma import, no I/O. The caller (home-preflight-resolver.ts) fetches
   the active (non-archived) MediaAsset id set once and passes it in.
   ========================================================================= */

export type HomeBlockIssueKind = "missing" | "media-missing";

export type HomeBlockIssue = Readonly<{
  blockId: string;
  blockType: HomeBlockType;
  kind: HomeBlockIssueKind;
}>;

/**
 * Flags every visible block whose media reference is empty ("missing") or
 * non-empty but absent from the current, non-archived `MediaAsset` id set
 * ("media-missing") - e.g. the asset was archived/deleted after the block
 * was saved. A block with no media field at all (`text`, `kpi`) is never
 * flagged. Hidden blocks (`visible: false`) are never flagged either - an
 * admin can stage an incomplete block without it blocking publish as long
 * as it stays hidden.
 */
export function inspectHomeSectionBlocks(
  payload: HomeSectionBlocksPayload,
  activeMediaAssetIds: ReadonlySet<string>,
): readonly HomeBlockIssue[] {
  const issues: HomeBlockIssue[] = [];
  for (const block of payload.blocks) {
    if (!block.visible) continue;
    let assetId: string | null = null;
    let hasMediaField = false;
    if (block.type === "image") {
      hasMediaField = true;
      assetId = block.assetId;
    } else if (block.type === "banner") {
      hasMediaField = true;
      assetId = block.mediaAssetId;
    } else if (block.type === "quote") {
      hasMediaField = true;
      assetId = block.mediaAssetId;
    }
    if (!hasMediaField) continue;
    if (assetId === null) {
      issues.push({ blockId: block.id, blockType: block.type, kind: "missing" });
    } else if (!activeMediaAssetIds.has(assetId)) {
      issues.push({ blockId: block.id, blockType: block.type, kind: "media-missing" });
    }
  }
  return issues;
}

export type HomeInvalidBlockInfo = Readonly<{
  index: number;
  blockId: string | null;
  message: string;
}>;

/**
 * Best-effort, display-only inspection of a raw (not-yet-validated)
 * payload's individual blocks, for the preflight matrix's "invalid"
 * breakdown (AC: preflight shows which blocks are invalid, not just that
 * the section as a whole is). Never the source of truth for the
 * NATIVE/FALLBACK_TR/OMITTED/INVALID outcome itself - that stays exactly
 * `composeHome`'s existing `validateHomeSectionPayload`-throws-or-not
 * decision, unchanged by this function.
 */
export function inspectRawHomeBlocksForDisplay(rawPayload: unknown): readonly HomeInvalidBlockInfo[] {
  if (typeof rawPayload !== "object" || rawPayload === null || !("blocks" in rawPayload)) {
    return [{ index: -1, blockId: null, message: "Bölüm içeriği okunamadı." }];
  }
  const blocksField = rawPayload.blocks;
  if (!Array.isArray(blocksField)) {
    return [{ index: -1, blockId: null, message: "Bölüm içeriği okunamadı." }];
  }
  const problems: HomeInvalidBlockInfo[] = [];
  blocksField.forEach((raw, index) => {
    const parsed = homeBlockSchema.safeParse(raw);
    if (parsed.success) return;
    let blockId: string | null = null;
    if (typeof raw === "object" && raw !== null && "id" in raw && typeof raw.id === "string") {
      blockId = raw.id;
    }
    problems.push({ index, blockId, message: parsed.error.issues[0]?.message ?? "Geçersiz blok." });
  });
  return problems;
}
