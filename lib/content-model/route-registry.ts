import type { ContentLocale } from "@prisma/client";
import { ContentModelError } from "./errors";

export type RouteCandidate = Readonly<{
  contentType: string;
  locale: ContentLocale;
  collectionSegment: string;
  slug: string;
}>;

/**
 * A `RouteCandidate` known to belong to a specific, already-verified entity
 * (e.g. a row read back from `ContentRoute`). Only this shape is accepted
 * by `resolvePublicRoute` - carrying `entityId` lets that function defend
 * its own entity-scoping invariant instead of merely trusting the caller's
 * query to have filtered correctly.
 */
export type PublishedRoute = RouteCandidate & Readonly<{ entityId: string }>;

/**
 * `publish()`'s (`./publishing.ts`) additive route-reservation hook input
 * (Story 0.4). `candidate` carries the caller's not-yet-normalized route
 * fields - `publish()` normalizes them via `normalizeRouteSegment` itself,
 * inside its own transaction, before checking collision. `generateRoute`
 * also re-normalizes defensively (see below), so a candidate reaching
 * either function unnormalized is rejected rather than silently trusted.
 */
export type RouteRegistrar = Readonly<{ candidate: RouteCandidate }>;

/** Control characters: C0 (U+0000-U+001F, DEL U+007F) and C1
 * (U+0080-U+009F, including NEL U+0085). */
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001F\u007F-\u009F]/;
/** Unicode line separator (U+2028) and paragraph separator (U+2029) - not
 * covered by the C0/C1 control ranges but equally able to break naive
 * line-oriented parsing of a URL if embedded in a segment. */
const LINE_PARAGRAPH_SEPARATOR_PATTERN = /[\u2028\u2029]/;
/** Arabic tatweel (kashida) - a decorative elongation character with no
 * distinguishing meaning of its own; two visually different slugs could
 * collide or spoof one another if it were allowed. */
const TATWEEL_PATTERN = /\u0640/;
/** Bidi/direction control characters: Arabic Letter Mark (U+061C), LRM/RLM
 * (U+200E/U+200F), the explicit embedding/override/pop controls
 * (U+202A-U+202E), and the isolate controls (U+2066-U+2069) - any of these
 * could reorder or hide adjacent text when a route segment is embedded in
 * a larger address. */
const BIDI_CONTROL_PATTERN = /[\u061C\u200E\u200F\u202A-\u202E\u2066-\u2069]/;
/** Invisible or zero-width formatting characters: ZWSP/ZWNJ/ZWJ
 * (U+200B-U+200D), word joiner (U+2060), BOM / zero-width no-break space
 * (U+FEFF), soft hyphen (U+00AD), combining grapheme joiner (U+034F), and
 * variation selectors (U+FE00-U+FE0F, U+E0100-U+E01EF) - all render as
 * nothing or near-nothing, letting visually-identical slugs differ at the
 * byte level. */
const INVISIBLE_PATTERN =
  /[\u200B-\u200D\u2060\uFEFF\u00AD\u034F\uFE00-\uFE0F\u{E0100}-\u{E01EF}]/u;
/** A route segment is one path component, never a sub-path or query/hash. */
const STRUCTURAL_SEPARATOR_PATTERN = /[/\\?#]/;
/** HTML/markup-significant characters. This slice's only consumer renders
 * URLs through React (`href={url}`), which escapes them safely - this
 * check is defense-in-depth so a route segment can never carry raw markup
 * regardless of how a future consumer renders it. */
const MARKUP_SIGNIFICANT_PATTERN = /[<>"'&]/;

type SegmentField = "collectionSegment" | "slug";

function rejectionMessage(locale: ContentLocale, field: SegmentField, rule: string): string {
  return `Invalid ${field} for locale "${locale}": ${rule}.`;
}

/**
 * Normalizes and validates one route segment field (a `collectionSegment`
 * or a `slug`) per AD-6 / `SPEC.md`'s constraints. Throws
 * `ContentModelError("invalidInput", ...)` with a locale-aware,
 * rule-naming message on any violation. Never touches Prisma or performs
 * I/O - a pure function. Idempotent: normalizing already-normalized text
 * returns it unchanged, so callers (including `generateRoute`, see below)
 * may safely call this more than once on the same value.
 */
export function normalizeRouteSegment(
  locale: ContentLocale,
  field: SegmentField,
  raw: string,
): string {
  if (raw.length === 0) {
    throw new ContentModelError("invalidInput", rejectionMessage(locale, field, "must not be empty"));
  }

  // Reject a segment that was already percent-encoded before reaching this
  // function: decoding it once should yield a value whose own further
  // decoding is a no-op (plain text has no percent sequences left). If a
  // second decode pass still changes the value, the input was encoded
  // twice - double-encoding is a known way to smuggle a forbidden
  // character or separator past a naive single-decode check. Detection
  // runs on the raw decode chain, before NFC normalization - it is about
  // encoding layers, not Unicode form.
  let decodedOnce: string;
  try {
    decodedOnce = decodeURIComponent(raw);
  } catch {
    throw new ContentModelError(
      "invalidInput",
      rejectionMessage(locale, field, "contains malformed percent-encoding"),
    );
  }
  let decodedTwice: string;
  try {
    decodedTwice = decodeURIComponent(decodedOnce);
  } catch {
    // A second decode failing is fine - it means decodedOnce contained a
    // literal "%" that isn't itself a valid percent-encoded triplet, i.e.
    // it was genuinely plain text after one decode.
    decodedTwice = decodedOnce;
  }
  if (decodedTwice !== decodedOnce) {
    throw new ContentModelError(
      "invalidInput",
      rejectionMessage(locale, field, "must not be percent-encoded more than once"),
    );
  }

  // NFC-normalize the *decoded* text - the percent-encoding, once removed,
  // may represent a UTF-8 sequence in NFD form; normalizing the still-encoded
  // raw string would leave that decomposed form untouched, since '%' and hex
  // digits are plain ASCII and NFC never rewrites them.
  const normalized = decodedOnce.normalize("NFC");

  if (CONTROL_CHARACTER_PATTERN.test(normalized)) {
    throw new ContentModelError(
      "invalidInput",
      rejectionMessage(locale, field, "must not contain a control character"),
    );
  }
  if (LINE_PARAGRAPH_SEPARATOR_PATTERN.test(normalized)) {
    throw new ContentModelError(
      "invalidInput",
      rejectionMessage(locale, field, "must not contain a line or paragraph separator character"),
    );
  }
  if (TATWEEL_PATTERN.test(normalized)) {
    throw new ContentModelError(
      "invalidInput",
      rejectionMessage(locale, field, "must not contain the Arabic tatweel character"),
    );
  }
  if (BIDI_CONTROL_PATTERN.test(normalized)) {
    throw new ContentModelError(
      "invalidInput",
      rejectionMessage(locale, field, "must not contain a bidirectional control character"),
    );
  }
  if (INVISIBLE_PATTERN.test(normalized)) {
    throw new ContentModelError(
      "invalidInput",
      rejectionMessage(locale, field, "must not contain an invisible or zero-width formatting character"),
    );
  }
  if (STRUCTURAL_SEPARATOR_PATTERN.test(normalized)) {
    throw new ContentModelError(
      "invalidInput",
      rejectionMessage(locale, field, "must not contain a path, query or fragment separator"),
    );
  }
  if (MARKUP_SIGNIFICANT_PATTERN.test(normalized)) {
    throw new ContentModelError(
      "invalidInput",
      rejectionMessage(locale, field, "must not contain an HTML-significant character"),
    );
  }

  return normalized;
}

/**
 * Generates the locale-native public URL for a route candidate, per AD-6:
 * Turkish is prefixless, `en`/`ru`/`ar` keep their locale prefix and use
 * their own native-script collection segment and slug.
 *
 * Re-runs `normalizeRouteSegment` on `collectionSegment`/`slug` itself
 * before templating - defense in depth so this function never assembles a
 * URL from an unsafe or unnormalized segment, regardless of whether the
 * caller already validated it. Idempotent for already-normalized input
 * (see `normalizeRouteSegment`'s doc comment), so this adds no observable
 * behavior change for any caller that was already passing normalized
 * candidates - it only closes the gap for one that was not. No Prisma, no
 * I/O.
 */
export function generateRoute(candidate: RouteCandidate): string {
  const collectionSegment = normalizeRouteSegment(
    candidate.locale,
    "collectionSegment",
    candidate.collectionSegment,
  );
  const slug = normalizeRouteSegment(candidate.locale, "slug", candidate.slug);
  if (candidate.locale === "tr") {
    return `/${collectionSegment}/${slug}`;
  }
  return `/${candidate.locale}/${collectionSegment}/${slug}`;
}

export type FallbackResolution =
  | Readonly<{ kind: "native"; url: string }>
  | Readonly<{ kind: "fallback"; url: string; canonical: string; noindex: true }>
  | Readonly<{ kind: "notFound" }>;

/**
 * Resolves a requested locale for a verified entity against that entity's
 * own set of published route rows, never inventing a target (AD-6 / CAP-3).
 * Defensively filters `availableRoutes` down to rows whose own `entityId`
 * matches the `entityId` argument before searching - a caller whose query
 * was not properly scoped to one entity (e.g. an unfiltered
 * `contentRoute.findMany()`) can never leak a different entity's route
 * through this function. The sanctioned way to obtain `PublishedRoute[]`
 * for this call is `getPublishedRouteCandidates` (`./route-reader.ts`),
 * which also excludes any row whose owning translation is not currently
 * published. Pure - no Prisma, no I/O, no raw request path ever accepted.
 */
export function resolvePublicRoute(
  entityId: string,
  requestedLocale: ContentLocale,
  availableRoutes: readonly PublishedRoute[],
): FallbackResolution {
  const ownRoutes = availableRoutes.filter((route) => route.entityId === entityId);

  const native = ownRoutes.find((route) => route.locale === requestedLocale);
  if (native) {
    return { kind: "native", url: generateRoute(native) };
  }

  const turkish = ownRoutes.find((route) => route.locale === "tr");
  if (turkish) {
    const url = generateRoute(turkish);
    return { kind: "fallback", url, canonical: url, noindex: true };
  }

  return { kind: "notFound" };
}
