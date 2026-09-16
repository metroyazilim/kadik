import type { PrismaClient } from "@prisma/client";
import { getPublished, type PublicTranslationProjection } from "./public-content-reader";
import { getPublishedRouteCandidates } from "./route-reader";
import type { PublishedRoute } from "./route-registry";

/**
 * `resolve()`'s swappable data-access seam (Story 0.2's mapping-lookup/
 * recorder port precedent). This slice supplies exactly one production
 * implementation, `PublishedContentStore` below, reading Story 0.2/0.3's
 * `ContentTranslation`/`ContentTranslationRevision`/`ContentEntity` tables
 * directly - a concrete legacy locale-table adapter is Epic 3+'s job,
 * behind this same port.
 */
export interface PublishedContentSource {
  /** `null` when the entity does not exist at all. Carries the entity's own
   * stored `contentType` so `resolve()` can reject a caller-supplied
   * `contentType` that does not match what this entity actually is -
   * trusting the caller's label alone would let a mismatched request read
   * (and mis-sanitize) another content type's payload under the wrong
   * rich-text field registration. */
  getEntityState(
    entityId: string,
  ): Promise<Readonly<{ archived: boolean; contentType: string }> | null>;
  getPublishedTranslation(
    entityId: string,
    locale: import("@prisma/client").ContentLocale,
  ): Promise<PublicTranslationProjection | null>;
  /** This entity's own published routes across every locale - the
   * sanctioned way to compute the Turkish fallback branch's `canonical`
   * URL (Story 0.4's `getPublishedRouteCandidates`), never a second,
   * independently-queried route lookup. */
  getEntityRoutes(entityId: string): Promise<readonly PublishedRoute[]>;
}

export class PublishedContentStore implements PublishedContentSource {
  constructor(private readonly client: PrismaClient) {}

  async getEntityState(
    entityId: string,
  ): Promise<Readonly<{ archived: boolean; contentType: string }> | null> {
    const entity = await this.client.contentEntity.findUnique({
      where: { id: entityId },
      select: { archived: true, contentType: true },
    });
    return entity ? { archived: entity.archived, contentType: entity.contentType } : null;
  }

  async getPublishedTranslation(
    entityId: string,
    locale: import("@prisma/client").ContentLocale,
  ): Promise<PublicTranslationProjection | null> {
    return getPublished(this.client, { entityId, locale });
  }

  async getEntityRoutes(entityId: string): Promise<readonly PublishedRoute[]> {
    return getPublishedRouteCandidates(this.client, entityId);
  }
}
