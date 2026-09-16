import { expect, test } from "@playwright/test";
import {
  SERVICE_FIXTURE_CONTENT_TYPE,
  SERVICE_FIXTURE_SCHEMA_VERSION,
  validatePayload,
} from "../../lib/content-model/payload-validation";
import { ContentModelError } from "../../lib/content-model/errors";
import {
  classifySourceRow,
  isUnresolvedSourceRow,
  type ServiceFixtureSourceRow,
} from "../../lib/content-model/backfill";
import type { MappingRecord } from "../../lib/content-model/mapping-port";
import { InMemoryMappingPort } from "../support/helpers/mapping-port-double";

function fixtureRow(overrides: Partial<ServiceFixtureSourceRow> = {}): ServiceFixtureSourceRow {
  return {
    sourceTable: "ServiceTr",
    sourcePrimaryKey: "row-1",
    sourceLocale: "tr",
    sourceHash: "hash-1",
    entityKey: "danismanlik",
    title: "Danışmanlık",
    slug: "danismanlik",
    category: "Hizmet",
    order: 0,
    published: true,
    ...overrides,
  };
}

function mappingRecord(overrides: Partial<MappingRecord> = {}): MappingRecord {
  return {
    migrationVersion: "story-0-2-v1",
    sourceTable: "ServiceTr",
    sourcePrimaryKey: "row-1",
    sourceLocale: "tr",
    sourceHash: "hash-1",
    targetEntityId: "entity-1",
    targetTranslationId: "translation-1",
    targetRevisionId: "revision-1",
    mappingMethod: "slug-match",
    mappingConfidence: "high",
    approvedBy: null,
    migratedAt: new Date("2026-09-05T00:00:00.000Z"),
    ...overrides,
  };
}

test.describe("Story 0.2 payload validation (AC-0.2-01, AC-0.2-03)", () => {
  test("CAP-1/CAP-2 accepts a well-formed Service fixture payload", () => {
    expect(() =>
      validatePayload(SERVICE_FIXTURE_CONTENT_TYPE, SERVICE_FIXTURE_SCHEMA_VERSION, {
        title: "Danışmanlık",
        slug: "danismanlik",
        category: "Hizmet",
        order: 0,
      }),
    ).not.toThrow();
  });

  test("CAP-1/CAP-2 rejects an unsupported content type", () => {
    expect(() => validatePayload("unknown-type", 1, { title: "x" })).toThrow(ContentModelError);
  });

  test("CAP-1/CAP-2 rejects an unsupported schema version", () => {
    expect(() =>
      validatePayload(SERVICE_FIXTURE_CONTENT_TYPE, 99, {
        title: "Danışmanlık",
        slug: "danismanlik",
        category: "Hizmet",
        order: 0,
      }),
    ).toThrow(ContentModelError);
  });

  test("CAP-1/CAP-2 rejects a payload missing a required field", () => {
    expect(() =>
      validatePayload(SERVICE_FIXTURE_CONTENT_TYPE, SERVICE_FIXTURE_SCHEMA_VERSION, {
        title: "",
        slug: "danismanlik",
        category: "Hizmet",
        order: 0,
      }),
    ).toThrow(ContentModelError);
  });

  test("CAP-1/CAP-2 rejects a non-integer or negative order", () => {
    expect(() =>
      validatePayload(SERVICE_FIXTURE_CONTENT_TYPE, SERVICE_FIXTURE_SCHEMA_VERSION, {
        title: "Danışmanlık",
        slug: "danismanlik",
        category: "Hizmet",
        order: -1,
      }),
    ).toThrow(ContentModelError);
    expect(() =>
      validatePayload(SERVICE_FIXTURE_CONTENT_TYPE, SERVICE_FIXTURE_SCHEMA_VERSION, {
        title: "Danışmanlık",
        slug: "danismanlik",
        category: "Hizmet",
        order: 1.5,
      }),
    ).toThrow(ContentModelError);
  });

  test("CAP-1/CAP-2 rejects a non-object payload", () => {
    expect(() =>
      validatePayload(SERVICE_FIXTURE_CONTENT_TYPE, SERVICE_FIXTURE_SCHEMA_VERSION, "not-an-object"),
    ).toThrow(ContentModelError);
    expect(() =>
      validatePayload(SERVICE_FIXTURE_CONTENT_TYPE, SERVICE_FIXTURE_SCHEMA_VERSION, null),
    ).toThrow(ContentModelError);
  });

  test("CAP-1/CAP-2 rejects a payload carrying an unexpected extra key", () => {
    expect(() =>
      validatePayload(SERVICE_FIXTURE_CONTENT_TYPE, SERVICE_FIXTURE_SCHEMA_VERSION, {
        title: "Danışmanlık",
        slug: "danismanlik",
        category: "Hizmet",
        order: 0,
        published: true,
      }),
    ).toThrow(ContentModelError);
  });
});

test.describe("Story 0.2 backfill classification (AC-0.2-04, AC-0.2-05)", () => {
  test("CAP-3 classifies a well-formed unmapped row as mapped", () => {
    expect(classifySourceRow(fixtureRow(), null)).toBe("mapped");
  });

  test("CAP-3 classifies a row missing a required field as unresolved", () => {
    expect(isUnresolvedSourceRow(fixtureRow({ title: "  " }))).toBe(true);
    expect(isUnresolvedSourceRow(fixtureRow({ slug: "" }))).toBe(true);
    expect(isUnresolvedSourceRow(fixtureRow({ category: "" }))).toBe(true);
    expect(isUnresolvedSourceRow(fixtureRow({ order: -1 }))).toBe(true);
    expect(isUnresolvedSourceRow(fixtureRow({ order: 1.5 }))).toBe(true);
    expect(classifySourceRow(fixtureRow({ title: "" }), null)).toBe("unresolved");
  });

  test("CAP-3 classifies a well-formed row as not unresolved", () => {
    expect(isUnresolvedSourceRow(fixtureRow())).toBe(false);
  });

  test("CAP-3 classifies a row with an unchanged mapped hash as alreadyMigrated", () => {
    const row = fixtureRow({ sourceHash: "hash-1" });
    const existing = mappingRecord({ sourceHash: "hash-1" });
    expect(classifySourceRow(row, existing)).toBe("alreadyMigrated");
  });

  test("CAP-3 classifies a row whose current hash no longer matches the recorded mapping as changedSinceLastRun", () => {
    const row = fixtureRow({ sourceHash: "hash-2" });
    const existing = mappingRecord({ sourceHash: "hash-1" });
    expect(classifySourceRow(row, existing)).toBe("changedSinceLastRun");
  });

  test("CAP-3 never classifies an unresolved row as mapped even with no existing mapping", () => {
    const row = fixtureRow({ slug: "" });
    expect(classifySourceRow(row, null)).not.toBe("mapped");
  });
});

test.describe("Story 0.2 in-memory mapping port identity contract (AC-0.2-05)", () => {
  test("CAP-3 returns null for an unmapped identity and the exact record once recorded", async () => {
    const port = new InMemoryMappingPort();
    expect(await port.lookupMapping("story-0-2-v1", "ServiceTr", "row-1")).toBeNull();

    const record = mappingRecord();
    await port.recordMapping(record);

    expect(await port.lookupMapping("story-0-2-v1", "ServiceTr", "row-1")).toEqual(record);
    expect(port.size).toBe(1);
  });

  test("CAP-3 rejects a second recordMapping call for the same migration identity", async () => {
    const port = new InMemoryMappingPort();
    await port.recordMapping(mappingRecord());
    await expect(port.recordMapping(mappingRecord({ sourceHash: "hash-2" }))).rejects.toThrow(
      "A mapping record already exists for this migration identity.",
    );
    expect(port.size).toBe(1);
  });

  test("CAP-3 keeps distinct source tables and primary keys as distinct identities", async () => {
    const port = new InMemoryMappingPort();
    await port.recordMapping(mappingRecord({ sourceTable: "ServiceTr", sourcePrimaryKey: "row-1" }));
    await port.recordMapping(mappingRecord({ sourceTable: "ServiceEn", sourcePrimaryKey: "row-1" }));
    await port.recordMapping(mappingRecord({ sourceTable: "ServiceTr", sourcePrimaryKey: "row-2" }));
    expect(port.size).toBe(3);
  });
});
