import { ContentModelError } from "./errors";
import { validateAndSanitizeRichText } from "./sanitization";
import { validateContentBlocks, type ContentBlock } from "./content-blocks";
import {
  asRecord,
  assertClosedShape,
  assertSchemaVersion,
  isNonEmptyString,
  isNullableMediaAssetId,
  isNullableString,
  isSafeNullableCtaUrl,
  requirePlainText,
} from "./field-guards";
import {
  homeSectionKeyFromContentType,
} from "./home-section-registry";
import {
  validateHomeSectionPayload,
  type HomeSectionPayloadMap,
} from "./home-section-schemas";
import {
  validateSiteSettingsPayload,
  SITE_SETTINGS_CONTENT_TYPE,
  type SiteSettingsPayload,
} from "./site-settings-schema";
import {
  validateAboutPagePayload,
  ABOUT_PAGE_CONTENT_TYPE,
  type AboutPagePayload,
} from "./about-page-schema";
import { contentPageKeyFromContentType } from "./content-page-registry";

/**
 * Per AD-2, a revision's payload shape is always known at read time because
 * validation is keyed by `contentType + schemaVersion`. Story 0.2 registers
 * exactly one shape - the Service-shaped foundation-contract verification
 * fixture (title, slug, category, order) used to prove CAP-1/CAP-2/CAP-3.
 * Every future content-type story adds its own `contentType` entry here; it
 * never redefines Service's.
 */
export const SERVICE_FIXTURE_CONTENT_TYPE = "service-fixture";
export const SERVICE_FIXTURE_SCHEMA_VERSION = 1;

export type ServiceFixturePayload = Readonly<{
  title: string;
  slug: string;
  category: string;
  order: number;
}>;

export const SERVICE_CONTENT_TYPE = "service";
/** Bumped 1 -> 2 when `body` (flat HTML string) became `blocks` (typed `ContentBlock[]`); pre-launch, no schemaVersion-1 Service revision is read by a v2-only validator. */
export const SERVICE_SCHEMA_VERSION = 2;

export type ServicePayload = Readonly<{
  title: string;
  slug: string;
  summary: string;
  blocks: readonly ContentBlock[];
  icon: string | null;
  imageAssetId: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
}>;

export const PRODUCT_CONTENT_TYPE = "product";
export const PRODUCT_SCHEMA_VERSION = 2;

export type ProductPayload = Readonly<{
  title: string;
  slug: string;
  summary: string;
  blocks: readonly ContentBlock[];
  imageAssetId: string | null;
  galleryAssetIds: readonly string[];
  badge: string | null;
  priceLabel: string | null;
  ctaUrl: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
}>;

export const PROJECT_CONTENT_TYPE = "project";
export const PROJECT_SCHEMA_VERSION = 2;

export type ProjectPayload = Readonly<{
  title: string;
  slug: string;
  category: string;
  coverImageAssetId: string | null;
  galleryAssetIds: readonly string[];
  challengeBlocks: readonly ContentBlock[];
  solutionBlocks: readonly ContentBlock[];
  client: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
}>;

export const TEAM_MEMBER_CONTENT_TYPE = "team-member";
export const TEAM_MEMBER_SCHEMA_VERSION = 1;

export type TeamMemberSocial = Readonly<{
  instagram: string | null;
  linkedin: string | null;
}>;

export type TeamMemberPayload = Readonly<{
  name: string;
  slug: string;
  role: string;
  imageAssetId: string | null;
  email: string | null;
  phone: string | null;
  social: TeamMemberSocial | null;
  bio: string;
  seoTitle: string | null;
  seoDescription: string | null;
}>;

/** No slug, no route, no SEO fields - FAQ has no per-item public URL (an
 * accordion on one static collection page), mirroring the legacy `FaqTr`
 * shape, which never had a `slug` column either. */
export const FAQ_CONTENT_TYPE = "faq";
export const FAQ_SCHEMA_VERSION = 1;

export type FaqPayload = Readonly<{
  question: string;
  answer: string;
}>;

/** Publication date is `ContentTranslation.publishedAt`, set by `publish()`
 * itself - never duplicated into the payload. */
export const POST_CONTENT_TYPE = "post";
export const POST_SCHEMA_VERSION = 2;

export type PostPayload = Readonly<{
  title: string;
  slug: string;
  excerpt: string;
  blocks: readonly ContentBlock[];
  category: string;
  author: string;
  coverImageAssetId: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
}>;

const SERVICE_FIXTURE_KEYS: ReadonlySet<string> = new Set(["title", "slug", "category", "order"]);
const SERVICE_PAYLOAD_KEYS: ReadonlySet<string> = new Set([
  "title",
  "slug",
  "summary",
  "blocks",
  "icon",
  "imageAssetId",
  "seoTitle",
  "seoDescription",
]);
const PRODUCT_PAYLOAD_KEYS: ReadonlySet<string> = new Set([
  "title",
  "slug",
  "summary",
  "blocks",
  "imageAssetId",
  "galleryAssetIds",
  "badge",
  "priceLabel",
  "ctaUrl",
  "seoTitle",
  "seoDescription",
]);
const PROJECT_PAYLOAD_KEYS: ReadonlySet<string> = new Set([
  "title",
  "slug",
  "category",
  "coverImageAssetId",
  "galleryAssetIds",
  "challengeBlocks",
  "solutionBlocks",
  "client",
  "seoTitle",
  "seoDescription",
]);
const TEAM_MEMBER_PAYLOAD_KEYS: ReadonlySet<string> = new Set([
  "name",
  "slug",
  "role",
  "imageAssetId",
  "email",
  "phone",
  "social",
  "bio",
  "seoTitle",
  "seoDescription",
]);
const FAQ_PAYLOAD_KEYS: ReadonlySet<string> = new Set(["question", "answer"]);
const POST_PAYLOAD_KEYS: ReadonlySet<string> = new Set([
  "title",
  "slug",
  "excerpt",
  "blocks",
  "category",
  "author",
  "coverImageAssetId",
  "seoTitle",
  "seoDescription",
]);

const MAX_GALLERY_ASSETS = 24;

function isMediaAssetIdArray(value: unknown): value is readonly string[] {
  return (
    Array.isArray(value) &&
    value.length <= MAX_GALLERY_ASSETS &&
    value.every((item) => typeof item === "string" && item.trim().length > 0)
  );
}

function validateServiceFixturePayload(schemaVersion: number, payload: unknown): ServiceFixturePayload {
  assertSchemaVersion(schemaVersion, SERVICE_FIXTURE_SCHEMA_VERSION);
  const candidate = asRecord(payload);
  assertClosedShape(candidate, SERVICE_FIXTURE_KEYS);
  const title = candidate.title;
  const slug = candidate.slug;
  const category = candidate.category;
  const order = candidate.order;
  if (
    !isNonEmptyString(title) ||
    !isNonEmptyString(slug) ||
    !isNonEmptyString(category) ||
    typeof order !== "number" ||
    !Number.isInteger(order) ||
    order < 0
  ) {
    throw new ContentModelError("invalidInput", "The payload shape is invalid.");
  }
  return { title, slug, category, order };
}

function validateServicePayload(schemaVersion: number, payload: unknown): ServicePayload {
  assertSchemaVersion(schemaVersion, SERVICE_SCHEMA_VERSION);
  const candidate = asRecord(payload);
  assertClosedShape(candidate, SERVICE_PAYLOAD_KEYS);

  const title = candidate.title;
  const slug = candidate.slug;
  const icon = candidate.icon;
  const imageAssetId = candidate.imageAssetId;
  const seoTitle = candidate.seoTitle;
  const seoDescription = candidate.seoDescription;
  if (
    !isNonEmptyString(title) ||
    !isNonEmptyString(slug) ||
    !isNullableString(icon) ||
    !isNullableMediaAssetId(imageAssetId) ||
    !isNullableString(seoTitle) ||
    !isNullableString(seoDescription)
  ) {
    throw new ContentModelError("invalidInput", "The payload shape is invalid.");
  }

  return {
    title,
    slug,
    summary: requirePlainText(candidate.summary, "summary", 300),
    blocks: validateContentBlocks(candidate.blocks, "blocks"),
    icon,
    imageAssetId,
    seoTitle,
    seoDescription,
  };
}

function validateProductPayload(schemaVersion: number, payload: unknown): ProductPayload {
  assertSchemaVersion(schemaVersion, PRODUCT_SCHEMA_VERSION);
  const candidate = asRecord(payload);
  assertClosedShape(candidate, PRODUCT_PAYLOAD_KEYS);

  const title = candidate.title;
  const slug = candidate.slug;
  const imageAssetId = candidate.imageAssetId;
  const galleryAssetIds = candidate.galleryAssetIds;
  const badge = candidate.badge;
  const priceLabel = candidate.priceLabel;
  const ctaUrl = candidate.ctaUrl;
  const seoTitle = candidate.seoTitle;
  const seoDescription = candidate.seoDescription;
  if (
    !isNonEmptyString(title) ||
    !isNonEmptyString(slug) ||
    !isNullableMediaAssetId(imageAssetId) ||
    !isMediaAssetIdArray(galleryAssetIds) ||
    !isNullableString(badge) ||
    !isNullableString(priceLabel) ||
    !isSafeNullableCtaUrl(ctaUrl) ||
    !isNullableString(seoTitle) ||
    !isNullableString(seoDescription)
  ) {
    throw new ContentModelError("invalidInput", "The payload shape is invalid.");
  }

  return {
    title,
    slug,
    summary: requirePlainText(candidate.summary, "summary", 300),
    blocks: validateContentBlocks(candidate.blocks, "blocks"),
    imageAssetId,
    galleryAssetIds,
    badge,
    priceLabel,
    ctaUrl,
    seoTitle,
    seoDescription,
  };
}

function validateProjectPayload(schemaVersion: number, payload: unknown): ProjectPayload {
  assertSchemaVersion(schemaVersion, PROJECT_SCHEMA_VERSION);
  const candidate = asRecord(payload);
  assertClosedShape(candidate, PROJECT_PAYLOAD_KEYS);

  const title = candidate.title;
  const slug = candidate.slug;
  const category = candidate.category;
  const coverImageAssetId = candidate.coverImageAssetId;
  const galleryAssetIds = candidate.galleryAssetIds;
  const client = candidate.client;
  const seoTitle = candidate.seoTitle;
  const seoDescription = candidate.seoDescription;
  if (
    !isNonEmptyString(title) ||
    !isNonEmptyString(slug) ||
    !isNonEmptyString(category) ||
    !isNullableMediaAssetId(coverImageAssetId) ||
    !isMediaAssetIdArray(galleryAssetIds) ||
    !isNullableString(client) ||
    !isNullableString(seoTitle) ||
    !isNullableString(seoDescription)
  ) {
    throw new ContentModelError("invalidInput", "The payload shape is invalid.");
  }

  return {
    title,
    slug,
    category,
    coverImageAssetId,
    galleryAssetIds,
    challengeBlocks: validateContentBlocks(candidate.challengeBlocks, "challengeBlocks"),
    solutionBlocks: validateContentBlocks(candidate.solutionBlocks, "solutionBlocks"),
    client,
    seoTitle,
    seoDescription,
  };
}

function validateTeamMemberSocial(value: unknown): TeamMemberSocial | null {
  if (value === null) return null;
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new ContentModelError("invalidInput", "Field 'social' must be an object or null.");
  }
  const candidate = value as Record<string, unknown>;
  const allowed = new Set(["instagram", "linkedin"]);
  if (!Object.keys(candidate).every((key) => allowed.has(key))) {
    throw new ContentModelError("invalidInput", "Field 'social' has an unsupported key.");
  }
  const instagram = candidate.instagram ?? null;
  const linkedin = candidate.linkedin ?? null;
  if (!isNullableString(instagram) || !isNullableString(linkedin)) {
    throw new ContentModelError("invalidInput", "Field 'social' has an invalid value.");
  }
  return { instagram, linkedin };
}

function validateTeamMemberPayload(schemaVersion: number, payload: unknown): TeamMemberPayload {
  assertSchemaVersion(schemaVersion, TEAM_MEMBER_SCHEMA_VERSION);
  const candidate = asRecord(payload);
  assertClosedShape(candidate, TEAM_MEMBER_PAYLOAD_KEYS);

  const name = candidate.name;
  const slug = candidate.slug;
  const role = candidate.role;
  const imageAssetId = candidate.imageAssetId;
  const email = candidate.email;
  const phone = candidate.phone;
  const seoTitle = candidate.seoTitle;
  const seoDescription = candidate.seoDescription;
  if (
    !isNonEmptyString(name) ||
    !isNonEmptyString(slug) ||
    !isNonEmptyString(role) ||
    !isNullableMediaAssetId(imageAssetId) ||
    !isNullableString(email) ||
    !isNullableString(phone) ||
    !isNullableString(seoTitle) ||
    !isNullableString(seoDescription)
  ) {
    throw new ContentModelError("invalidInput", "The payload shape is invalid.");
  }

  return {
    name,
    slug,
    role,
    imageAssetId,
    email,
    phone,
    social: validateTeamMemberSocial(candidate.social ?? null),
    bio: validateAndSanitizeRichText(candidate.bio, "bio", 4000),
    seoTitle,
    seoDescription,
  };
}

function validateFaqPayload(schemaVersion: number, payload: unknown): FaqPayload {
  assertSchemaVersion(schemaVersion, FAQ_SCHEMA_VERSION);
  const candidate = asRecord(payload);
  assertClosedShape(candidate, FAQ_PAYLOAD_KEYS);

  const question = candidate.question;
  if (!isNonEmptyString(question)) {
    throw new ContentModelError("invalidInput", "The payload shape is invalid.");
  }

  return {
    question,
    answer: validateAndSanitizeRichText(candidate.answer, "answer", 4000),
  };
}

function validatePostPayload(schemaVersion: number, payload: unknown): PostPayload {
  assertSchemaVersion(schemaVersion, POST_SCHEMA_VERSION);
  const candidate = asRecord(payload);
  assertClosedShape(candidate, POST_PAYLOAD_KEYS);

  const title = candidate.title;
  const slug = candidate.slug;
  const category = candidate.category;
  const author = candidate.author;
  const coverImageAssetId = candidate.coverImageAssetId;
  const seoTitle = candidate.seoTitle;
  const seoDescription = candidate.seoDescription;
  if (
    !isNonEmptyString(title) ||
    !isNonEmptyString(slug) ||
    !isNonEmptyString(category) ||
    !isNonEmptyString(author) ||
    !isNullableMediaAssetId(coverImageAssetId) ||
    !isNullableString(seoTitle) ||
    !isNullableString(seoDescription)
  ) {
    throw new ContentModelError("invalidInput", "The payload shape is invalid.");
  }

  return {
    title,
    slug,
    excerpt: requirePlainText(candidate.excerpt, "excerpt", 300),
    blocks: validateContentBlocks(candidate.blocks, "blocks"),
    category,
    author,
    coverImageAssetId,
    seoTitle,
    seoDescription,
  };
}

/**
 * Validates `payload` against the registered shape for `contentType` and
 * `schemaVersion`, throwing `ContentModelError("invalidInput", ...)` on any
 * mismatch, and returns a freshly constructed canonical payload - never the
 * caller-owned object reference - for the caller to persist. Called before
 * a draft revision is created, and again against the candidate draft
 * revision at publish time (full payload validation of the candidate draft
 * revision, per `content-model.md`'s publish transaction boundary) - never
 * after a revision has been persisted unvalidated.
 */
export type ValidatedPayload =
  | ServiceFixturePayload
  | ServicePayload
  | ProductPayload
  | ProjectPayload
  | TeamMemberPayload
  | FaqPayload
  | PostPayload
  | SiteSettingsPayload
  | AboutPagePayload
  | HomeSectionPayloadMap[keyof HomeSectionPayloadMap]
  | Record<string, unknown>;

export function validatePayload(
  contentType: string,
  schemaVersion: number,
  payload: unknown,
): ValidatedPayload {
  const homeSectionKey = homeSectionKeyFromContentType(contentType);
  if (homeSectionKey !== null) {
    return validateHomeSectionPayload(homeSectionKey, schemaVersion, payload);
  }

  const contentPageKey = contentPageKeyFromContentType(contentType);
  if (contentPageKey === "about") {
    return validateAboutPagePayload(schemaVersion, payload);
  }

  switch (contentType) {
    case SERVICE_FIXTURE_CONTENT_TYPE:
      return validateServiceFixturePayload(schemaVersion, payload);
    case SERVICE_CONTENT_TYPE:
      return validateServicePayload(schemaVersion, payload);
    case PRODUCT_CONTENT_TYPE:
      return validateProductPayload(schemaVersion, payload);
    case PROJECT_CONTENT_TYPE:
      return validateProjectPayload(schemaVersion, payload);
    case TEAM_MEMBER_CONTENT_TYPE:
      return validateTeamMemberPayload(schemaVersion, payload);
    case FAQ_CONTENT_TYPE:
      return validateFaqPayload(schemaVersion, payload);
    case POST_CONTENT_TYPE:
      return validatePostPayload(schemaVersion, payload);
    case SITE_SETTINGS_CONTENT_TYPE:
      return validateSiteSettingsPayload(schemaVersion, payload);
    default:
      throw new ContentModelError("invalidInput", `The content type '${contentType}' is not supported.`);
  }
}
