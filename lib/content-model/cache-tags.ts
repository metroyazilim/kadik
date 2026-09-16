import type { ContentLocale } from "@prisma/client";

/**
 * The single shared cache-dependency tag vocabulary (Story 5.1 CAP-3, AD-5's
 * negative-cache rule). `InvalidationOutboxEvent.tags` (Story 0.5) already has
 * a `String[]` slot for exactly this format; this module defines the literal
 * string shape so a later `publish()` outbox hook and every public-read
 * surface (`resolve()`, route resolution, navigation composition) speak the
 * same tag language, never two independently invented ones. Pure string
 * formatting only - no Prisma import, no I/O.
 */

/** Invalidated whenever the entity itself changes (archive, unarchive, delete). */
export function contentEntityTag(entityId: string): string {
  return `content:entity:${entityId}`;
}

/**
 * Invalidated whenever a given locale's publish state for this entity
 * changes (a fresh publish, an unpublish/archive). Used for both the
 * positive case (a translation is published) and AD-5's negative-cache case
 * (no published translation exists yet for that locale) - the tag names an
 * *availability* fact, not merely a "this row exists" fact.
 */
export function contentAvailabilityTag(entityId: string, locale: ContentLocale): string {
  return `content:translation:${entityId}:${locale}:availability`;
}

/** Invalidated only when this exact published revision is superseded. */
export function contentRevisionTag(
  entityId: string,
  locale: ContentLocale,
  revisionId: string,
): string {
  return `content:translation:${entityId}:${locale}:revision:${revisionId}`;
}

/**
 * A single, non-entity-scoped tag for the navigation/footer configuration
 * itself (Story 5.4 CAP-3) - invalidated when the nav/footer config changes
 * independent of any one entity's publish state. Extended in place here
 * rather than as a second, independently formatted tag string function.
 */
export function navigationConfigTag(): string {
  return "content:navigation:config";
}

/**
 * A single, non-entity-scoped tag for every SEO-dependent public surface
 * (metadata, canonical/hreflang, sitemap/robots, the admin audit panel -
 * Story 6.2 CAP-4) - invalidated whenever any publish could change what
 * those surfaces render, alongside whatever entity/translation/collection
 * tags that publish already carries.
 */
export function seoIndexTag(): string {
  return "content:seo:index";
}
