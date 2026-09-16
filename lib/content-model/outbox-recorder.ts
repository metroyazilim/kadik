import type { ContentLocale, Prisma } from "@prisma/client";

/**
 * The durable cache-invalidation signal `publish()` (`./publishing.ts`)
 * commits alongside a successful publish (Story 0.5, closing the seam
 * Story 0.2/0.3/0.4 each reserved but never filled). `sourceTranslationId`/
 * `locale` mirror `InvalidationOutboxEvent`'s own nullable columns - always
 * populated by this slice's own verification (every event it emits comes
 * from a real published translation), but left nullable at the type level
 * to match the schema's allowance for a future domain-level event that is
 * not translation-scoped. `tags` is the cache dependency tag set AD-5
 * describes; composing the full tag set for every content type is Epic 5's
 * job, not this slice's.
 */
export type OutboxEvent = Readonly<{
  sourceEntityId: string;
  sourceTranslationId: string;
  locale: ContentLocale;
  tags: readonly string[];
}>;

/**
 * Invoked by `publish()` *inside* its own `$transaction`, after the pointer
 * swap and after the `audit`/`route` hooks (if present) succeed - so a
 * throw here rolls back the whole publish (pointer, audit row, route
 * reservation) along with the outbox write itself, per AC-0.5-01.
 * `publishing.ts` only knows this callback shape; it never imports the
 * `InvalidationOutboxEvent` model directly - that stays this hook's
 * caller's concern, keeping the dependency direction one-way (the same
 * separation `AuditRecorder` already established for Story 0.3).
 */
export type OutboxRecorder = (
  tx: Prisma.TransactionClient,
  event: OutboxEvent,
) => Promise<void>;

/**
 * `publish()`'s (`./publishing.ts`) additive invalidation-outbox hook
 * input (Story 0.5), mirroring `RouteRegistrar`'s shape
 * (`./route-registry.ts`, Story 0.4): `tags` is data only the caller can
 * supply - which cache-dependency tags apply is content-type-specific
 * business knowledge `publish()` itself has no way to derive - while
 * `publish()` composes `sourceEntityId`/`sourceTranslationId`/`locale`
 * itself from the translation it is actually publishing.
 */
export type OutboxRegistrar = Readonly<{
  recorder: OutboxRecorder;
  tags: readonly string[];
}>;
