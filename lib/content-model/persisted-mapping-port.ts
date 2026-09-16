import type { PrismaClient } from "@prisma/client";
import type { Db } from "./db";
import type { MappingLookupPort, MappingRecord, MappingRecorderPort } from "./mapping-port";

/**
 * The persisted implementation of Story 0.2's mapping-lookup/recorder port
 * (`./mapping-port.ts`), backed by the `LegacyMigrationMap` table (Story
 * 0.5). Story 0.2 deliberately proved `dryRunBackfill`/`runBackfill` only
 * against `InMemoryMappingPort` (a test double); this class is the first
 * concrete, real implementation of the identical port signature - neither
 * `dryRunBackfill` nor `runBackfill` (`./backfill.ts`) is modified at all
 * to use it, proving the substitution Story 0.2's own port abstraction
 * promised.
 *
 * `(migrationVersion, sourceTable, sourcePrimaryKey)` is enforced unique at
 * the database level (`LegacyMigrationMap`'s compound `@@unique`), mirroring
 * `InMemoryMappingPort`'s in-memory identity contract exactly.
 * `recordMapping` on a duplicate identity throws the database's own
 * unique-constraint violation - `InMemoryMappingPort` already throws on the
 * same duplicate case (`ContractSafeError("conflict", ...)`), so
 * `runBackfill`'s existing error handling around `recordMapping` is
 * unchanged by which port implementation is in use.
 */
export class PersistedMappingPort implements MappingLookupPort, MappingRecorderPort {
  constructor(private readonly client: PrismaClient) {}

  async lookupMapping(
    migrationVersion: string,
    sourceTable: string,
    sourcePrimaryKey: string,
    tx?: Db,
  ): Promise<MappingRecord | null> {
    const row = await (tx ?? this.client).legacyMigrationMap.findUnique({
      where: {
        migrationVersion_sourceTable_sourcePrimaryKey: {
          migrationVersion,
          sourceTable,
          sourcePrimaryKey,
        },
      },
    });
    if (!row) return null;

    return {
      migrationVersion: row.migrationVersion,
      sourceTable: row.sourceTable,
      sourcePrimaryKey: row.sourcePrimaryKey,
      sourceLocale: row.sourceLocale,
      sourceHash: row.sourceHash,
      targetEntityId: row.targetEntityId,
      targetTranslationId: row.targetTranslationId,
      targetRevisionId: row.targetRevisionId,
      mappingMethod: row.mappingMethod,
      mappingConfidence: row.mappingConfidence as MappingRecord["mappingConfidence"],
      approvedBy: row.approvedBy,
      migratedAt: row.migratedAt,
    };
  }

  async recordMapping(record: MappingRecord, tx?: Db): Promise<void> {
    await (tx ?? this.client).legacyMigrationMap.create({
      data: {
        migrationVersion: record.migrationVersion,
        sourceTable: record.sourceTable,
        sourcePrimaryKey: record.sourcePrimaryKey,
        sourceLocale: record.sourceLocale,
        sourceHash: record.sourceHash,
        targetEntityId: record.targetEntityId,
        targetTranslationId: record.targetTranslationId,
        targetRevisionId: record.targetRevisionId,
        mappingMethod: record.mappingMethod,
        mappingConfidence: record.mappingConfidence,
        approvedBy: record.approvedBy,
        migratedAt: record.migratedAt,
      },
    });
  }
}
