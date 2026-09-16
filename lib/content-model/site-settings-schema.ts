import { ContentModelError } from "./errors";
import { validateAndSanitizeRichText } from "./sanitization";
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

/**
 * Story 6.1's single, locale-aware site-settings content type (AC-6.1):
 * brand/contact/CTA/navigation/footer/mission/vision/terms/privacy, all
 * versioned together as one payload per locale through the unmodified
 * `ContentTranslation`/`ContentTranslationRevision` machinery (Story 0.2) -
 * exactly like every Epic 3 domain, just with exactly one entity (see
 * `site-settings-registry.ts`) instead of a collection.
 */
export const SITE_SETTINGS_CONTENT_TYPE = "site-settings";
export const SITE_SETTINGS_SCHEMA_VERSION = 1;

/**
 * A navigation/footer link target (AC-6.1 bullet 4): either a plain safe
 * URL/site-relative path (`external` - covers static pages, in-page
 * anchors, and anything not modeled as managed content), or a reference to
 * a specific managed content entity (`collection` - a Service/Product/
 * Project/Post/FAQ record) whose *current* draft/archived/published state
 * is resolved separately, at read time, against the route registry
 * (`site-settings-nav.ts`) - never baked into this payload, which only ever
 * stores the stable reference itself.
 */
export type NavTargetPayload =
  | Readonly<{ kind: "external"; url: string }>
  | Readonly<{ kind: "collection"; contentType: string; entityId: string }>;

export type NavChildPayload = Readonly<{
  id: string;
  label: string;
  target: NavTargetPayload;
}>;

export type NavItemPayload = Readonly<{
  id: string;
  label: string;
  target: NavTargetPayload;
  children: readonly NavChildPayload[];
}>;

export type FooterLinkPayload = Readonly<{
  id: string;
  label: string;
  target: NavTargetPayload;
}>;

export type FooterColumnPayload = Readonly<{
  id: string;
  title: string;
  links: readonly FooterLinkPayload[];
}>;

export type SiteSettingsPayload = Readonly<{
  brand: Readonly<{ name: string; logoAssetId: string | null }>;
  contact: Readonly<{ email: string | null; phone: string | null; address: string | null }>;
  cta: Readonly<{ label: string | null; url: string | null }>;
  navigation: readonly NavItemPayload[];
  footer: Readonly<{ summary: string; columns: readonly FooterColumnPayload[] }>;
  mission: string;
  vision: string;
  termsBody: string;
  privacyBody: string;
}>;

const SITE_SETTINGS_PAYLOAD_KEYS: ReadonlySet<string> = new Set([
  "brand",
  "contact",
  "cta",
  "navigation",
  "footer",
  "mission",
  "vision",
  "termsBody",
  "privacyBody",
]);

const BRAND_KEYS: ReadonlySet<string> = new Set(["name", "logoAssetId"]);
const CONTACT_KEYS: ReadonlySet<string> = new Set(["email", "phone", "address"]);
const CTA_KEYS: ReadonlySet<string> = new Set(["label", "url"]);
const NAV_TARGET_EXTERNAL_KEYS: ReadonlySet<string> = new Set(["kind", "url"]);
const NAV_TARGET_COLLECTION_KEYS: ReadonlySet<string> = new Set(["kind", "contentType", "entityId"]);
const NAV_CHILD_KEYS: ReadonlySet<string> = new Set(["id", "label", "target"]);
const NAV_ITEM_KEYS: ReadonlySet<string> = new Set(["id", "label", "target", "children"]);
const FOOTER_LINK_KEYS: ReadonlySet<string> = new Set(["id", "label", "target"]);
const FOOTER_COLUMN_KEYS: ReadonlySet<string> = new Set(["id", "title", "links"]);
const FOOTER_KEYS: ReadonlySet<string> = new Set(["summary", "columns"]);

const MAX_NAV_ITEMS = 12;
const MAX_NAV_CHILDREN = 8;
const MAX_FOOTER_COLUMNS = 6;
const MAX_FOOTER_LINKS_PER_COLUMN = 10;

function invalid(): never {
  throw new ContentModelError("invalidInput", "The payload shape is invalid.");
}

function validateNavTarget(value: unknown): NavTargetPayload {
  const record = asRecord(value);
  const kind = record.kind;
  if (kind === "external") {
    assertClosedShape(record, NAV_TARGET_EXTERNAL_KEYS);
    const url = record.url;
    if (!isSafeNullableCtaUrl(url) || url === null) invalid();
    return { kind: "external", url };
  }
  if (kind === "collection") {
    assertClosedShape(record, NAV_TARGET_COLLECTION_KEYS);
    const contentType = record.contentType;
    const entityId = record.entityId;
    if (!isNonEmptyString(contentType) || !isNonEmptyString(entityId)) invalid();
    return { kind: "collection", contentType, entityId };
  }
  return invalid();
}

function validateNavChild(value: unknown): NavChildPayload {
  const record = asRecord(value);
  assertClosedShape(record, NAV_CHILD_KEYS);
  const id = record.id;
  if (!isNonEmptyString(id)) invalid();
  return {
    id,
    label: requirePlainText(record.label, "children[].label", 80),
    target: validateNavTarget(record.target),
  };
}

function validateNavItem(value: unknown): NavItemPayload {
  const record = asRecord(value);
  assertClosedShape(record, NAV_ITEM_KEYS);
  const id = record.id;
  if (!isNonEmptyString(id)) invalid();
  const childrenRaw = record.children;
  if (!Array.isArray(childrenRaw) || childrenRaw.length > MAX_NAV_CHILDREN) invalid();
  return {
    id,
    label: requirePlainText(record.label, "navigation[].label", 80),
    target: validateNavTarget(record.target),
    children: childrenRaw.map(validateNavChild),
  };
}

function validateFooterLink(value: unknown): FooterLinkPayload {
  const record = asRecord(value);
  assertClosedShape(record, FOOTER_LINK_KEYS);
  const id = record.id;
  if (!isNonEmptyString(id)) invalid();
  return {
    id,
    label: requirePlainText(record.label, "footer.columns[].links[].label", 80),
    target: validateNavTarget(record.target),
  };
}

function validateFooterColumn(value: unknown): FooterColumnPayload {
  const record = asRecord(value);
  assertClosedShape(record, FOOTER_COLUMN_KEYS);
  const id = record.id;
  if (!isNonEmptyString(id)) invalid();
  const linksRaw = record.links;
  if (!Array.isArray(linksRaw) || linksRaw.length > MAX_FOOTER_LINKS_PER_COLUMN) invalid();
  return {
    id,
    title: requirePlainText(record.title, "footer.columns[].title", 80),
    links: linksRaw.map(validateFooterLink),
  };
}

export function validateSiteSettingsPayload(schemaVersion: number, payload: unknown): SiteSettingsPayload {
  assertSchemaVersion(schemaVersion, SITE_SETTINGS_SCHEMA_VERSION);
  const candidate = asRecord(payload);
  assertClosedShape(candidate, SITE_SETTINGS_PAYLOAD_KEYS);

  const brandRecord = asRecord(candidate.brand);
  assertClosedShape(brandRecord, BRAND_KEYS);
  const logoAssetId = brandRecord.logoAssetId;
  if (!isNullableMediaAssetId(logoAssetId)) invalid();

  const contactRecord = asRecord(candidate.contact);
  assertClosedShape(contactRecord, CONTACT_KEYS);
  const email = contactRecord.email;
  const phone = contactRecord.phone;
  const address = contactRecord.address;
  if (!isNullableString(email) || !isNullableString(phone) || !isNullableString(address)) invalid();

  const ctaRecord = asRecord(candidate.cta);
  assertClosedShape(ctaRecord, CTA_KEYS);
  const ctaLabel = ctaRecord.label;
  const ctaUrl = ctaRecord.url;
  if (!isNullableString(ctaLabel) || !isSafeNullableCtaUrl(ctaUrl)) invalid();
  // A CTA is either fully absent or fully present - a label with no
  // destination (or a destination with no visible label) is never a valid
  // rendered call-to-action.
  if ((ctaLabel === null) !== (ctaUrl === null)) invalid();

  const navigationRaw = candidate.navigation;
  if (!Array.isArray(navigationRaw) || navigationRaw.length > MAX_NAV_ITEMS) invalid();

  const footerRecord = asRecord(candidate.footer);
  assertClosedShape(footerRecord, FOOTER_KEYS);
  const columnsRaw = footerRecord.columns;
  if (!Array.isArray(columnsRaw) || columnsRaw.length > MAX_FOOTER_COLUMNS) invalid();

  return {
    brand: {
      name: requirePlainText(brandRecord.name, "brand.name", 120),
      logoAssetId,
    },
    contact: { email, phone, address },
    cta: { label: ctaLabel, url: ctaUrl },
    navigation: navigationRaw.map(validateNavItem),
    footer: {
      summary: requirePlainText(footerRecord.summary, "footer.summary", 400),
      columns: columnsRaw.map(validateFooterColumn),
    },
    mission: requirePlainText(candidate.mission, "mission", 600),
    vision: requirePlainText(candidate.vision, "vision", 600),
    termsBody: validateAndSanitizeRichText(candidate.termsBody, "termsBody", 40000, false),
    privacyBody: validateAndSanitizeRichText(candidate.privacyBody, "privacyBody", 40000, false),
  };
}
