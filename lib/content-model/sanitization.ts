import type { Prisma } from "@prisma/client";
import sanitizeHtml from "sanitize-html";
import { Parser as HtmlParser } from "htmlparser2";
import { ContentModelError } from "./errors";
import {
  RICH_TEXT_ALLOWED_ATTRIBUTES,
  RICH_TEXT_ALLOWED_TAGS,
  RICH_TEXT_ALLOWED_URL_SCHEMES,
  RICH_TEXT_STRIPPED_CONTENT_TAGS,
} from "./rich-text-allowlist";

/**
 * `sanitize-html` configuration derived from the single shared allow-list
 * (Spec 4 AC-4.5/AC-4.8) - a maintained, tokenizing HTML parser replaces the
 * pre-Spec-4 regex-based tag rewriter, closing the bypass classes a regex
 * parser cannot structurally defend against (split/nested tags, attribute
 * values containing `>`, newline/entity-split attribute names, comment-
 * boundary tricks, and any mutation a browser performs while re-parsing
 * malformed regex output).
 *
 * `transformTags.a` is the one place link attributes are computed, mirroring
 * the pre-Spec-4 behavior for `target`/`rel` exactly: any `target` value is
 * preserved verbatim, and `rel="noopener noreferrer"` is forced only when
 * `target` is `_blank` (an existing `rel` on a non-`_blank` link is
 * preserved as authored). `href` is only trimmed here, never re-encoded -
 * `allowedSchemes`/`allowedSchemesByTag` run their scheme check on this
 * transformed value, so encoding it here first would risk corrupting the
 * very substring (`javascript:`, `data:`, `vbscript:`) that check looks
 * for. `allowedSchemes` then independently drops the whole `href` for any
 * scheme not in the shared allow-list.
 */
const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [...RICH_TEXT_ALLOWED_TAGS],
  allowedAttributes: Object.fromEntries(
    Object.entries(RICH_TEXT_ALLOWED_ATTRIBUTES).map(([tag, attrs]) => [tag, [...attrs]]),
  ),
  allowedSchemes: [...RICH_TEXT_ALLOWED_URL_SCHEMES],
  allowedSchemesByTag: { a: [...RICH_TEXT_ALLOWED_URL_SCHEMES] },
  allowProtocolRelative: false,
  nonTextTags: [...RICH_TEXT_STRIPPED_CONTENT_TAGS],
  enforceHtmlBoundary: true,
  transformTags: {
    a: (_tagName, attribs) => {
      const out: Record<string, string> = {};
      if (attribs.href) out.href = attribs.href.trim();
      if (attribs.target) out.target = attribs.target;
      if (attribs.target?.toLowerCase() === "_blank") out.rel = "noopener noreferrer";
      else if (attribs.rel) out.rel = attribs.rel;
      return { tagName: "a", attribs: out };
    },
  },
};

/**
 * Server-side HTML sanitizer for rich text content (Spec 4). Tokenizes the
 * input through `sanitize-html` configured from `rich-text-allowlist.ts`;
 * anything not in that allow-list - a tag, an attribute, or a URL scheme -
 * is dropped. Idempotent: sanitizing already-sanitized output is a no-op,
 * which both the write-time and read-time re-sanitization boundaries
 * depend on.
 */
export function sanitizeRichHtml(dirty: string): string {
  if (!dirty || typeof dirty !== "string") {
    return "";
  }
  return sanitizeHtml(dirty, SANITIZE_OPTIONS).trim();
}

/**
 * Strips all HTML tags to get raw text content for character length /
 * presence checks. This is plain text extraction, not a security boundary -
 * it makes no allow/deny decision about any tag, attribute, or URL, so it
 * never substitutes for `sanitizeRichHtml`. Built on `htmlparser2` (the
 * tokenizer `sanitize-html` itself is built on) rather than a tag-matching
 * regular expression, with entity decoding disabled so literal entities
 * such as `&amp;` pass through unchanged, matching how this value has
 * always been compared/measured.
 */
export function stripHtmlToText(html: string): string {
  if (!html || typeof html !== "string") {
    return "";
  }
  const parts: string[] = [];
  const parser = new HtmlParser(
    {
      onopentag() {
        parts.push(" ");
      },
      onclosetag() {
        parts.push(" ");
      },
      ontext(text) {
        parts.push(text);
      },
    },
    { decodeEntities: false },
  );
  parser.write(html);
  parser.end();
  return parts.join("").replace(/\s+/g, " ").trim();
}

/**
 * Validates and sanitizes a rich text string:
 * - Checks max raw string length
 * - Checks that the text content is not empty if required
 * - Returns the canonical sanitized HTML string.
 */
export function validateAndSanitizeRichText(
  value: unknown,
  fieldName: string,
  maxLength = 1000,
  required = true,
): string {
  if (typeof value !== "string") {
    throw new ContentModelError("invalidInput", `Field '${fieldName}' must be a string.`);
  }

  const sanitized = sanitizeRichHtml(value);
  const plainText = stripHtmlToText(sanitized);

  if (required && plainText.length === 0) {
    throw new ContentModelError("invalidInput", `Field '${fieldName}' cannot be empty.`);
  }

  if (sanitized.length > maxLength) {
    throw new ContentModelError(
      "invalidInput",
      `Field '${fieldName}' exceeds the maximum allowed length of ${maxLength} characters.`,
    );
  }

  return sanitized;
}

/**
 * Defense-in-depth re-sanitization for the public read boundary (Story 5.1
 * CAP-2, "Rich text yalnız server-side sanitize edilmiş canonical çıktıdan
 * render edilecek"). `validatePayload()` (`./payload-validation.ts`, AD-2)
 * is the single write-time enforcement point for a content type's shape and
 * rich-text sanitization - `saveDraft`/`publish` never persist a revision
 * that skipped it. This function does not replace that enforcement; it
 * re-verifies it defensively at read time, so a future bug at the write
 * boundary (a content type forgetting to call `sanitizeRichHtml` on one of
 * its own fields) can never surface as unsanitized markup through a public
 * reader. Idempotent on already-canonical input - re-sanitizing a value
 * `sanitizeRichHtml` already produced is a no-op, so this adds no
 * observable difference for correctly-written content types.
 *
 * `richTextFieldNames` is supplied by the caller (a small per-content-type
 * registry, e.g. `rich-text-field-registry.ts`) - this function never
 * guesses which fields are rich text from their runtime shape. A field not
 * named here (a plain string like `slug`) is left untouched. `payload` must
 * already be the plain, parsed JSON object `validatePayload` returns -
 * never a raw string re-parsed here.
 */
export function sanitizeCanonicalPayload(
  payload: Prisma.JsonValue,
  richTextFieldNames: readonly string[],
): Prisma.JsonValue {
  if (richTextFieldNames.length === 0) return payload;
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) return payload;

  const source = payload as Record<string, Prisma.JsonValue>;
  const result: Record<string, Prisma.JsonValue> = { ...source };
  for (const key of richTextFieldNames) {
    const value = source[key];
    if (typeof value === "string") {
      result[key] = sanitizeRichHtml(value);
    }
  }
  return result;
}
