import type { ContentLocale, PrismaClient } from "@prisma/client";
import { ContentModelError } from "./errors";
import { createEntity, createTranslation } from "./model";
import { SERVICE_FIXTURE_CONTENT_TYPE, SERVICE_FIXTURE_SCHEMA_VERSION } from "./payload-validation";
import { publish, saveDraft } from "./publishing";
import type { MappingLookupPort, MappingRecord, MappingRecorderPort } from "./mapping-port";

/**
 * A Service-shaped legacy-style fixture source row (title, slug, category,
 * order, published - mirroring `ServiceTr/En/Ru/Ar`'s real shape) used only
 * to verify CAP-1/CAP-2/CAP-3's dry-run and idempotent-backfill mechanism.
 * `entityKey` groups the rows that represent the same conceptual item across
 * `tr`/`en`/`ru`/`ar` (analogous to a slug-match across a legacy table's
 * per-locale physical rows) - never Service's real legacy tables.
 */
export type ServiceFixtureSourceRow = Readonly<{
  sourceTable: string;
  sourcePrimaryKey: string;
  sourceLocale: ContentLocale;
  sourceHash: string;
  entityKey: string;
  title: string;
  slug: string;
  category: string;
  order: number;
  published: boolean;
}>;

export type BackfillBucket =
  | "mapped"
  | "unresolved"
  | "alreadyMigrated"
  | "changedSinceLastRun";

export type BackfillReport = Readonly<{
  counted: number;
  mapped: number;
  unresolved: number;
  alreadyMigrated: number;
  changedSinceLastRun: number;
}>;

type MutableReport = { -readonly [K in keyof BackfillReport]: BackfillReport[K] };

function emptyReport(): MutableReport {
  return { counted: 0, mapped: 0, unresolved: 0, alreadyMigrated: 0, changedSinceLastRun: 0 };
}

/** Ambiguous match or missing required field - excluded from persistence. */
export function isUnresolvedSourceRow(row: ServiceFixtureSourceRow): boolean {
  return (
    row.title.trim().length === 0 ||
    row.slug.trim().length === 0 ||
    row.category.trim().length === 0 ||
    !Number.isInteger(row.order) ||
    row.order < 0
  );
}

/**
 * Pure classification: given the row and its existing mapping record (if
 * `lookupMapping` found one), decides which of the four `BackfillBucket`
 * values the row belongs in, in isolation from every other row. No I/O.
 * `classifyBatch` layers the one additional, batch-wide rule (ambiguous
 * duplicate `(entityKey, sourceLocale)` pairs) on top of this.
 */
export function classifySourceRow(
  row: ServiceFixtureSourceRow,
  existing: MappingRecord | null,
): BackfillBucket {
  if (existing) {
    return existing.sourceHash === row.sourceHash ? "alreadyMigrated" : "changedSinceLastRun";
  }
  return isUnresolvedSourceRow(row) ? "unresolved" : "mapped";
}

function entityKeyLocaleId(row: ServiceFixtureSourceRow): string {
  return `${row.entityKey}\u0000${row.sourceLocale}`;
}

type ClassifiedRow = Readonly<{
  row: ServiceFixtureSourceRow;
  bucket: BackfillBucket;
  existing: MappingRecord | null;
}>;

/**
 * Shared classification pass used by both `dryRunBackfill` and
 * `runBackfill`, so a dry-run always predicts exactly what a real run would
 * do. Order-independent: phase 1 resolves every row's existing mapping
 * record (read-only I/O); phase 2 computes, from *all* of them at once,
 * which `(entityKey, sourceLocale)` pairs are already occupied by an
 * existing mapping record - anywhere in the batch, regardless of row
 * order; phase 3 classifies each row in the caller's original order. A row
 * that would otherwise be "mapped" but whose pair is already occupied -
 * by an existing record or by an earlier row in this same batch - is an
 * ambiguous duplicate match per `legacy-backfill-mapping.md` and is
 * reclassified `unresolved` rather than reaching the database's
 * `(entityId, locale)` uniqueness constraint as a raw, unsafe failure.
 * Resolving occupancy before classifying any row is what keeps both this
 * rule and `runBackfill`'s entity-grouping independent of whichever order
 * the caller happens to list rows in.
 */
async function classifyBatch(
  port: MappingLookupPort,
  migrationVersion: string,
  rows: readonly ServiceFixtureSourceRow[],
): Promise<ClassifiedRow[]> {
  const withExisting: Array<Readonly<{ row: ServiceFixtureSourceRow; existing: MappingRecord | null }>> = [];
  for (const row of rows) {
    const existing = await port.lookupMapping(migrationVersion, row.sourceTable, row.sourcePrimaryKey);
    withExisting.push({ row, existing });
  }

  const occupiedKeyLocale = new Set<string>();
  for (const { row, existing } of withExisting) {
    if (existing) occupiedKeyLocale.add(entityKeyLocaleId(row));
  }

  const classified: ClassifiedRow[] = [];
  for (const { row, existing } of withExisting) {
    const provisional = classifySourceRow(row, existing);
    const keyLocale = entityKeyLocaleId(row);
    let bucket: BackfillBucket = provisional;
    if (provisional === "mapped") {
      if (occupiedKeyLocale.has(keyLocale)) {
        bucket = "unresolved";
      } else {
        occupiedKeyLocale.add(keyLocale);
      }
    }
    classified.push({ row, bucket, existing });
  }
  return classified;
}

/**
 * Read-only report over the four buckets. Calls only `lookupMapping`, never
 * `recordMapping`; persists nothing.
 */
export async function dryRunBackfill(
  port: MappingLookupPort,
  migrationVersion: string,
  rows: readonly ServiceFixtureSourceRow[],
): Promise<BackfillReport> {
  const report = emptyReport();
  const classified = await classifyBatch(port, migrationVersion, rows);
  for (const { bucket } of classified) {
    report.counted += 1;
    report[bucket] += 1;
  }
  return report;
}

/**
 * Idempotent backfill. For each row not already mapped (per `lookupMapping`)
 * and not unresolved: reuses or creates the target entity keyed by
 * `entityKey`, creates the translation, saves one immutable draft revision,
 * publishes it too when the source row was published (`draftRevisionId` and
 * `publishedRevisionId` then point at the same revision), and records the
 * mapping. Rows whose mapping already exists with a matching `sourceHash`,
 * or whose source changed since the last pass, are left untouched -
 * `targetEntityId` is pre-seeded into `entityIdByKey` for *every* row in the
 * batch before any row is written - regardless of where in `rows` it
 * appears - so a later pass adding a new locale for the same `entityKey`
 * always joins the already-mapped entity instead of splitting it, no
 * matter which order the caller lists rows in. Backfill never mutates a
 * legacy source table; it only reads `rows` (already extracted by the
 * caller) and writes the new shared-model tables plus the mapping port.
 */
export async function runBackfill(
  client: PrismaClient,
  port: MappingLookupPort & MappingRecorderPort,
  migrationVersion: string,
  rows: readonly ServiceFixtureSourceRow[],
): Promise<BackfillReport> {
  const report = emptyReport();
  const classified = await classifyBatch(port, migrationVersion, rows);

  const entityIdByKey = new Map<string, string>();
  for (const { row, existing } of classified) {
    if (existing) {
      entityIdByKey.set(row.entityKey, existing.targetEntityId);
    }
  }

  for (const { row, bucket } of classified) {
    report.counted += 1;
    report[bucket] += 1;
    if (bucket !== "mapped") continue;

    let entityId = entityIdByKey.get(row.entityKey);
    if (entityId === undefined) {
      const entity = await createEntity(client, {
        contentType: SERVICE_FIXTURE_CONTENT_TYPE,
        provenance: "legacy-backfill",
      });
      entityId = entity.id;
      entityIdByKey.set(row.entityKey, entityId);
    }

    const translation = await createTranslation(client, { entityId, locale: row.sourceLocale });
    const draftResult = await saveDraft(client, {
      translationId: translation.id,
      expectedVersion: translation.version,
      schemaVersion: SERVICE_FIXTURE_SCHEMA_VERSION,
      payload: { title: row.title, slug: row.slug, category: row.category, order: row.order },
      createdBy: `legacy-backfill:${migrationVersion}`,
    });
    if (!draftResult.ok) {
      throw new ContentModelError(
        "internal",
        "Backfill draft save unexpectedly conflicted on a translation it just created.",
      );
    }

    if (row.published) {
      const publishResult = await publish(client, {
        translationId: translation.id,
        expectedVersion: draftResult.translation.version,
        expectedDraftRevisionId: draftResult.revisionId,
      });
      if (!publishResult.ok) {
        throw new ContentModelError(
          "internal",
          "Backfill publish unexpectedly conflicted on a translation it just drafted.",
        );
      }
    }

    await port.recordMapping({
      migrationVersion,
      sourceTable: row.sourceTable,
      sourcePrimaryKey: row.sourcePrimaryKey,
      sourceLocale: row.sourceLocale,
      sourceHash: row.sourceHash,
      targetEntityId: entityId,
      targetTranslationId: translation.id,
      targetRevisionId: draftResult.revisionId,
      mappingMethod: "slug-match",
      mappingConfidence: "high",
      approvedBy: null,
      migratedAt: new Date(),
    });
  }

  return report;
}
