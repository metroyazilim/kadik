import { ContentModelError } from "./errors";

/**
 * Pure, side-effect-free payload field guards shared by `payload-validation.ts`
 * (flat content-type payloads) and `content-blocks.ts` (typed block payloads).
 * Extracted so both modules can depend on one guard implementation without
 * creating a circular import between them (`payload-validation.ts` calls
 * `validateContentBlocks`; `content-blocks.ts` must therefore never import
 * `payload-validation.ts`).
 */

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/** Title/slug/summary/SEO-style bound: trimmed, required, length-capped. Never HTML-sanitized - these fields are never rendered as HTML. */
export function requirePlainText(value: unknown, fieldName: string, maxLength: number): string {
  if (!isNonEmptyString(value)) {
    throw new ContentModelError("invalidInput", `Field '${fieldName}' is required.`);
  }
  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    throw new ContentModelError("invalidInput", `Field '${fieldName}' exceeds ${maxLength} characters.`);
  }
  return trimmed;
}

/** `null` passes through as `null`; any other value must satisfy `requirePlainText`. Never silently coerces a malformed non-null value to `null`. */
export function optionalPlainText(value: unknown, fieldName: string, maxLength: number): string | null {
  if (value === null) return null;
  return requirePlainText(value, fieldName, maxLength);
}

export function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

/** Shape-only check - a real `MediaAsset` existence/archived check runs separately (`content-media.ts`) before this payload is ever persisted. */
export function isNullableMediaAssetId(value: unknown): value is string | null {
  return value === null || (typeof value === "string" && value.trim().length > 0);
}

/** Never a data:/javascript: URL - only an absolute http(s) link or a site-relative path, matching `route-registry.ts`'s own "no arbitrary scheme" discipline for anything that ends up in an `href`. */
export function isSafeNullableCtaUrl(value: unknown): value is string | null {
  if (value === null) return true;
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (trimmed.length === 0) return false;
  return trimmed.startsWith("/") || /^https?:\/\//i.test(trimmed);
}

export function assertClosedShape(candidate: Record<string, unknown>, allowed: ReadonlySet<string>): void {
  const keys = Object.keys(candidate);
  if (keys.length !== allowed.size || !keys.every((key) => allowed.has(key))) {
    throw new ContentModelError("invalidInput", "The payload shape is invalid.");
  }
}

export function asRecord(payload: unknown): Record<string, unknown> {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    throw new ContentModelError("invalidInput", "The payload shape is invalid.");
  }
  return payload as Record<string, unknown>;
}

export function assertSchemaVersion(actual: number, expected: number): void {
  if (actual !== expected) {
    throw new ContentModelError(
      "invalidInput",
      "The payload schema version is not supported for this content type.",
    );
  }
}
