import { ContentModelError } from "./errors";
import { validateAndSanitizeRichText } from "./sanitization";
import {
  asRecord,
  assertClosedShape,
  assertSchemaVersion,
  isNullableMediaAssetId,
  isNullableString,
  requirePlainText,
} from "./field-guards";

/**
 * Spec 3's single admin-managed page content type: About
 * (`lib/content-model/content-page-registry.ts`'s `ContentPageKey.about`).
 * Mirrors every enumerated field the pre-cutover `dict.aboutPage` (deleted
 * by this spec) carried, field for field, EXCEPT `projects` -
 * grep-verified dead in `lib/public-pages/about.tsx`'s actual render
 * output before this cutover (never read from the dictionary object on
 * the page), so it is not carried into the new payload rather than
 * persisted as three more admin-editable entries nothing ever shows.
 */
export const ABOUT_PAGE_CONTENT_TYPE = "content-page:about";
export const ABOUT_PAGE_SCHEMA_VERSION = 1;

export type AboutFeaturePayload = Readonly<{ title: string; text: string }>;

export type AboutPagePayload = Readonly<{
  banner: string;
  subtitle: string;
  /** Split so the accent word can be wrapped in brand colour without JSX in the payload - mirrors the deleted dictionary shape exactly. */
  titleBefore: string;
  titleAccent: string;
  titleAfter: string;
  /** Rich text: sanitized on write (here) and re-sanitized on read (`public-content-reader.ts`'s defense-in-depth pass), rendered with `dangerouslySetInnerHTML` - same contract as `TeamMemberPayload.bio`. */
  text: string;
  collageImageAssetId: string | null;
  collageAlt: string;
  experienceValue: string;
  experienceUnit: string;
  experienceLabel: string;
  /** Exactly two - the page pairs each with a fixed icon by array index (`icon-4.svg`/`icon-5.svg`); reorderable (which feature renders first) but not addable/removable. */
  features: readonly [AboutFeaturePayload, AboutFeaturePayload];
  offeringSubtitle: string;
  offeringTitle: string;
  /** Exactly five - paired by index with a fixed icon set (Website/Android/iOS/Watch/IOT); reorderable, not addable/removable. */
  offeringLabels: readonly [string, string, string, string, string];
  /** One to eight words - the marquee simply repeats the same decorative asterisk before each, so (unlike `features`/`offeringLabels`) count is not tied to a fixed icon slot; freely addable/removable/reorderable. */
  marquee: readonly string[];
  teamSubtitle: string;
  teamTitle: string;
  /** The byline under the hero's "Learn More" button (photo + name + role) - a real person, not decoration, so its photo is media-library-backed like `collageImageAssetId`. */
  authorName: string;
  authorRole: string;
  authorImageAssetId: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
}>;

const ABOUT_PAGE_PAYLOAD_KEYS: ReadonlySet<string> = new Set([
  "banner",
  "subtitle",
  "titleBefore",
  "titleAccent",
  "titleAfter",
  "text",
  "collageImageAssetId",
  "collageAlt",
  "experienceValue",
  "experienceUnit",
  "experienceLabel",
  "features",
  "offeringSubtitle",
  "offeringTitle",
  "offeringLabels",
  "marquee",
  "teamSubtitle",
  "teamTitle",
  "authorName",
  "authorRole",
  "authorImageAssetId",
  "seoTitle",
  "seoDescription",
]);

const ABOUT_FEATURE_KEYS: ReadonlySet<string> = new Set(["title", "text"]);

const MAX_MARQUEE_WORDS = 8;

function validateAboutFeature(value: unknown): AboutFeaturePayload {
  const candidate = asRecord(value);
  assertClosedShape(candidate, ABOUT_FEATURE_KEYS);
  return {
    title: requirePlainText(candidate.title, "features[].title", 80),
    text: requirePlainText(candidate.text, "features[].text", 200),
  };
}

function validateAboutFeatures(value: unknown): readonly [AboutFeaturePayload, AboutFeaturePayload] {
  if (!Array.isArray(value) || value.length !== 2) {
    throw new ContentModelError("invalidInput", "Field 'features' must contain exactly two entries.");
  }
  const [first, second] = value;
  return [validateAboutFeature(first), validateAboutFeature(second)];
}

function validateOfferingLabels(value: unknown): readonly [string, string, string, string, string] {
  if (!Array.isArray(value) || value.length !== 5) {
    throw new ContentModelError("invalidInput", "Field 'offeringLabels' must contain exactly five entries.");
  }
  const labels = value.map((label, index) => requirePlainText(label, `offeringLabels[${index}]`, 60));
  return labels as [string, string, string, string, string];
}

function validateMarquee(value: unknown): readonly string[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_MARQUEE_WORDS) {
    throw new ContentModelError(
      "invalidInput",
      `Field 'marquee' must contain between 1 and ${MAX_MARQUEE_WORDS} entries.`,
    );
  }
  return value.map((word, index) => requirePlainText(word, `marquee[${index}]`, 60));
}

export function validateAboutPagePayload(schemaVersion: number, payload: unknown): AboutPagePayload {
  assertSchemaVersion(schemaVersion, ABOUT_PAGE_SCHEMA_VERSION);
  const candidate = asRecord(payload);
  assertClosedShape(candidate, ABOUT_PAGE_PAYLOAD_KEYS);

  const collageImageAssetId = candidate.collageImageAssetId;
  const authorImageAssetId = candidate.authorImageAssetId;
  const seoTitle = candidate.seoTitle;
  const seoDescription = candidate.seoDescription;
  if (
    !isNullableMediaAssetId(collageImageAssetId) ||
    !isNullableMediaAssetId(authorImageAssetId) ||
    !isNullableString(seoTitle) ||
    !isNullableString(seoDescription)
  ) {
    throw new ContentModelError("invalidInput", "The payload shape is invalid.");
  }

  return {
    banner: requirePlainText(candidate.banner, "banner", 150),
    subtitle: requirePlainText(candidate.subtitle, "subtitle", 150),
    titleBefore: requirePlainText(candidate.titleBefore, "titleBefore", 100),
    titleAccent: requirePlainText(candidate.titleAccent, "titleAccent", 100),
    titleAfter: requirePlainText(candidate.titleAfter, "titleAfter", 100),
    text: validateAndSanitizeRichText(candidate.text, "text", 2000),
    collageImageAssetId,
    collageAlt: requirePlainText(candidate.collageAlt, "collageAlt", 150),
    experienceValue: requirePlainText(candidate.experienceValue, "experienceValue", 20),
    experienceUnit: requirePlainText(candidate.experienceUnit, "experienceUnit", 40),
    experienceLabel: requirePlainText(candidate.experienceLabel, "experienceLabel", 80),
    features: validateAboutFeatures(candidate.features),
    offeringSubtitle: requirePlainText(candidate.offeringSubtitle, "offeringSubtitle", 150),
    offeringTitle: requirePlainText(candidate.offeringTitle, "offeringTitle", 150),
    offeringLabels: validateOfferingLabels(candidate.offeringLabels),
    marquee: validateMarquee(candidate.marquee),
    teamSubtitle: requirePlainText(candidate.teamSubtitle, "teamSubtitle", 150),
    teamTitle: requirePlainText(candidate.teamTitle, "teamTitle", 150),
    authorName: requirePlainText(candidate.authorName, "authorName", 100),
    authorRole: requirePlainText(candidate.authorRole, "authorRole", 100),
    authorImageAssetId,
    seoTitle,
    seoDescription,
  };
}
