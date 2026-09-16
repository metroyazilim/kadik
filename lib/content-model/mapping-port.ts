import type { ContentLocale } from "@prisma/client";
import type { Db } from "./db";

/**
 * Mapping-record interface (per AD-8, `legacy-backfill-mapping.md`). This is
 * a **type contract**, not a Story 0.2 Prisma model - Story 0.5 supplies the
 * concrete persisted `LegacyMigrationMap` table implementing the identical
 * port below. `(migrationVersion, sourceTable, sourcePrimaryKey)` MUST be
 * unique across mapping records; every port implementation enforces that
 * identity rule, in memory or in a database unique constraint alike.
 */
export type MappingConfidence = "high" | "low";

export type MappingRecord = Readonly<{
  migrationVersion: string;
  sourceTable: string;
  sourcePrimaryKey: string;
  sourceLocale: ContentLocale;
  sourceHash: string;
  targetEntityId: string;
  targetTranslationId: string;
  targetRevisionId: string;
  mappingMethod: string;
  mappingConfidence: MappingConfidence;
  approvedBy: string | null;
  migratedAt: Date;
}>;

/** Narrow read port dry-run and backfill call through - never a concrete repository.
 * `tx`, when supplied, scopes the lookup to that transaction client instead of
 * the port's own top-level `PrismaClient` - `runDomainBackfill` passes its
 * per-row `tx` here so classification reads inside a retried transaction see
 * that transaction's own uncommitted writes rather than the outer client's. */
export interface MappingLookupPort {
  lookupMapping(
    migrationVersion: string,
    sourceTable: string,
    sourcePrimaryKey: string,
    tx?: Db,
  ): Promise<MappingRecord | null>;
}

/** Narrow write port backfill calls through once a row is newly mapped.
 * `tx`, when supplied, scopes the write to that transaction client so the
 * mapping row commits or rolls back together with the entity/translation/
 * revision writes `runDomainBackfill` makes in the same transaction. */
export interface MappingRecorderPort {
  recordMapping(record: MappingRecord, tx?: Db): Promise<void>;
}
