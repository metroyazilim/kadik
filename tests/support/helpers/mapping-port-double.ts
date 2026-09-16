import type {
  MappingLookupPort,
  MappingRecord,
  MappingRecorderPort,
} from "../../../lib/content-model/mapping-port";
import { ContractSafeError } from "./contract-result";

function mappingKey(migrationVersion: string, sourceTable: string, sourcePrimaryKey: string): string {
  // JSON-encode the tuple rather than joining with a delimiter: a delimiter
  // (even an unusual one) can still appear inside an unrestricted string
  // field and make two distinct triples collide on the same key.
  return JSON.stringify([migrationVersion, sourceTable, sourcePrimaryKey]);
}

/**
 * Story 0.2's own in-memory implementation of the mapping-lookup/recorder
 * port (per `legacy-backfill-mapping.md`): scoped to a single test run,
 * discarded after. Enforces the same `(migrationVersion, sourceTable,
 * sourcePrimaryKey)` uniqueness identity contract Story 0.5's persisted
 * `LegacyMigrationMap` adapter will later enforce as a database unique
 * constraint - `recordMapping` rejects a second write under an existing key,
 * so a classification bug that tries to re-record an already-migrated row is
 * caught rather than silently corrupting the in-memory map.
 */
export class InMemoryMappingPort implements MappingLookupPort, MappingRecorderPort {
  private readonly records = new Map<string, MappingRecord>();

  async lookupMapping(
    migrationVersion: string,
    sourceTable: string,
    sourcePrimaryKey: string,
  ): Promise<MappingRecord | null> {
    return this.records.get(mappingKey(migrationVersion, sourceTable, sourcePrimaryKey)) ?? null;
  }

  async recordMapping(record: MappingRecord): Promise<void> {
    const key = mappingKey(record.migrationVersion, record.sourceTable, record.sourcePrimaryKey);
    if (this.records.has(key)) {
      throw new ContractSafeError(
        "conflict",
        "A mapping record already exists for this migration identity.",
      );
    }
    this.records.set(key, record);
  }

  get size(): number {
    return this.records.size;
  }
}
