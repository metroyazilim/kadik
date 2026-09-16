/**
 * Single allow-list module (Spec 4 AC-4.8): the maintained server sanitizer
 * (`sanitization.ts`'s `sanitize-html` configuration) and the maintained
 * Tiptap editor's extension set (`components/admin/rich-text/extensions.ts`)
 * both derive their allowed markup from this one place, so the editor can
 * never produce a tag/attribute/URL scheme the server sanitizer would
 * silently drop - the exact drift ("editor inserts tags it hopes are
 * allowed; sanitizer independently decides what survives") that let `u` and
 * `span` accumulate with no editor affordance before this unit.
 *
 * The tag set is a superset of the pre-Spec-4 hand-written sanitizer's
 * `ALLOWED_TAGS` (`p`, `br`, `strong`, `b`, `em`, `i`, `u`, `a`, `span`,
 * `ul`, `ol`, `li`) plus the headings and blockquote the required minimum
 * toolbar (`docs/context/ui-context.md`) produces - existing content must
 * round-trip losslessly and the new toolbar must never emit a tag this
 * allow-list rejects (Spec 4 §8 compatibility plan, AC-4.4).
 */

export const RICH_TEXT_ALLOWED_TAGS = [
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "a",
  "span",
  "ul",
  "ol",
  "li",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "blockquote",
] as const;

export type RichTextAllowedTag = (typeof RICH_TEXT_ALLOWED_TAGS)[number];

/**
 * Per-tag allowed attribute names. A tag not listed here (every allowed tag
 * except `a`) keeps no attributes at all - `style`, `class`, and every
 * `on*` handler are dropped regardless of casing or whitespace, matching
 * the pre-Spec-4 sanitizer's "strip all attributes for deterministic
 * safety" rule for non-link tags.
 */
export const RICH_TEXT_ALLOWED_ATTRIBUTES: Readonly<Record<string, readonly string[]>> = {
  a: ["href", "target", "rel"],
};

/**
 * `href` values whose scheme is one of these are kept. A scheme-less value
 * (a site-relative path such as `/hizmetler` or a `#fragment`) is always
 * allowed independently of this list - only a value that parses as having
 * an explicit scheme is checked against it. Every other scheme
 * (`javascript:`, `data:`, `vbscript:`, obfuscated or not, and any scheme
 * not named here) is dropped.
 */
export const RICH_TEXT_ALLOWED_URL_SCHEMES = ["http", "https", "mailto", "tel"] as const;

/**
 * Tags whose content must never survive as plain text once the tag itself
 * is discarded - the boundary that defeats `<svg><script>…` and sibling
 * nesting tricks for the specific elements that can carry executable or
 * loadable content. Every other disallowed tag (e.g. a bare `<svg>` with no
 * dangerous child) is discarded but its inner text is kept, matching the
 * pre-Spec-4 sanitizer's per-tag (not per-subtree) removal.
 *
 * A superset of `sanitize-html`'s own default `nonTextTags` (`script`,
 * `style`, `textarea`, `option`, `xmp`) plus this app's own additions
 * (`iframe`, `object`, `embed`, `noscript`) - overriding `nonTextTags`
 * replaces rather than merges with the library default, so every
 * vendor-documented entry is repeated here explicitly rather than assumed.
 * `xmp` in particular closes a documented bypass: htmlparser2 tokenizes it
 * as a raw-text element, so a disallowed `<xmp>` left out of this list
 * would let its literal, undecoded content (e.g. a nested `<script>`) leak
 * through as unparsed text.
 */
export const RICH_TEXT_STRIPPED_CONTENT_TAGS = [
  "script",
  "style",
  "textarea",
  "option",
  "xmp",
  "iframe",
  "object",
  "embed",
  "noscript",
] as const;
