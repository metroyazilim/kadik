import { expect, test } from "@playwright/test";
import {
  ACCEPTANCE_CRITERION_IDS,
  CAPABILITY_IDS,
  ContractSafeError,
  createContractResult,
} from "../support/helpers/contract-result";
import {
  FIXTURE_SCENARIOS,
  TEST_LOCALES,
  buildFixtureMatrix,
  buildScenarioFixture,
  validateRunIdentity,
} from "../support/helpers/test-fixtures";
import {
  classifyDatabaseFailure,
  databaseUrlForSchema,
  requireTestDatabaseUrl,
  schemaNameForRunIdentity,
} from "../support/helpers/test-database";
import { combineFixtureFailures } from "../support/fixtures/story-0-1-fixture";

const RUN_IDENTITY = "unit-story-0-1";

test.describe("Story 0.1 deterministic fixture contracts", () => {
  test("CAP-1 builds the complete deterministic scenario matrix", () => {
    const first = buildFixtureMatrix(RUN_IDENTITY);
    const second = buildFixtureMatrix(RUN_IDENTITY);

    expect(second).toEqual(first);
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
    expect(first).toHaveLength(18);
    expect(new Set(first.map((fixture) => fixture.identity)).size).toBe(first.length);
    expect(new Set(first.map((fixture) => fixture.scenario))).toEqual(
      new Set(FIXTURE_SCENARIOS),
    );
    expect(new Set(first.flatMap((fixture) => fixture.locale ?? []))).toEqual(
      new Set(TEST_LOCALES),
    );

    for (const fixture of first) {
      expect(fixture.identity.startsWith(`${RUN_IDENTITY}:`)).toBe(true);
      expect(fixture.runIdentity).toBe(RUN_IDENTITY);
    }
  });

  test("CAP-1 rejects unsupported or ambiguous fixture input", () => {
    expect(() =>
      buildScenarioFixture(RUN_IDENTITY, { scenario: "deleted", locale: "tr" }),
    ).toThrow(ContractSafeError);
    expect(() =>
      buildScenarioFixture(RUN_IDENTITY, { scenario: "native", locale: "de" }),
    ).toThrow(ContractSafeError);
    expect(() =>
      buildScenarioFixture(RUN_IDENTITY, { scenario: "invalid", locale: "tr" }),
    ).toThrow(ContractSafeError);
    expect(() =>
      buildScenarioFixture(RUN_IDENTITY, { scenario: "fallback", locale: "tr" }),
    ).toThrow(ContractSafeError);
    for (const prototypeKey of ["constructor", "toString", "__proto__"]) {
      expect(() =>
        buildScenarioFixture(RUN_IDENTITY, {
          scenario: prototypeKey,
          locale: "tr",
        }),
      ).toThrow(ContractSafeError);
      expect(() =>
        buildScenarioFixture(RUN_IDENTITY, {
          scenario: "draft",
          locale: prototypeKey,
        }),
      ).toThrow(ContractSafeError);
    }
  });

  test("CAP-2 serializes only the approved safe result boundary", () => {
    const secret = "postgresql://admin:super-secret@production.internal/metro";
    expect(CAPABILITY_IDS).toEqual(["CAP-1", "CAP-2", "CAP-3"]);
    expect(ACCEPTANCE_CRITERION_IDS).toEqual([
      "AC-0.1-01",
      "AC-0.1-02",
      "AC-0.1-03",
      "AC-0.1-04",
      "AC-0.1-05",
      "AC-0.1-06",
      "AC-0.1-07",
    ]);
    const result = createContractResult({
      capabilityId: "CAP-2",
      acceptanceCriterionId: "AC-0.1-03",
      runIdentity: RUN_IDENTITY,
      fixtureIdentity: `${RUN_IDENTITY}:conflict:tr`,
      outcome: "setupFailure",
      statusCode: 503,
      failure: new Error(`connection failed for ${secret}`),
    });
    const serialized = JSON.stringify(result);

    expect(result).toEqual({
      capabilityId: "CAP-2",
      acceptanceCriterionId: "AC-0.1-03",
      runIdentity: RUN_IDENTITY,
      fixtureIdentity: `${RUN_IDENTITY}:conflict:tr`,
      outcome: "setupFailure",
      statusCode: 503,
      failure: {
        classification: "internal",
        reason: "An internal contract failure occurred.",
      },
    });
    expect(serialized).not.toContain("super-secret");
    expect(serialized).not.toContain("production.internal");
    expect(serialized).not.toContain("stack");
    expect(serialized).not.toContain("payload");
  });

  test("CAP-2 rejects prototype properties as result allowlist values", () => {
    expect(() =>
      createContractResult({
        capabilityId: "constructor" as "CAP-1",
        acceptanceCriterionId: "AC-0.1-01",
        runIdentity: RUN_IDENTITY,
        fixtureIdentity: `${RUN_IDENTITY}:published:tr`,
        outcome: "ok",
      }),
    ).toThrow(ContractSafeError);
    expect(() =>
      createContractResult({
        capabilityId: "CAP-2",
        acceptanceCriterionId: "AC-0.1-03",
        runIdentity: RUN_IDENTITY,
        fixtureIdentity: `${RUN_IDENTITY}:published:tr`,
        outcome: "constructor" as "ok",
      }),
    ).toThrow(ContractSafeError);
    const sanitizedPrototypeFailure = createContractResult({
      capabilityId: "CAP-2",
      acceptanceCriterionId: "AC-0.1-03",
      runIdentity: RUN_IDENTITY,
      fixtureIdentity: `${RUN_IDENTITY}:published:tr`,
      outcome: "setupFailure",
      failure: new ContractSafeError(
        "constructor" as "internal",
        "secret prototype value",
      ),
    });
    expect(sanitizedPrototypeFailure.failure).toEqual({
      classification: "internal",
      reason: "An internal contract failure occurred.",
    });
  });

  test("CAP-2 preserves approved classification without exposing its cause", () => {
    const rootCause = new Error("password=secret");
    const failure = new ContractSafeError(
      "databaseCapabilityMissing",
      "Database denied password=secret at production.internal.",
      { cause: rootCause },
    );
    const result = createContractResult({
      capabilityId: "CAP-2",
      acceptanceCriterionId: "AC-0.1-03",
      runIdentity: RUN_IDENTITY,
      fixtureIdentity: `${RUN_IDENTITY}:published:en`,
      outcome: "setupFailure",
      failure,
    });
    expect(failure.cause).toBe(rootCause);

    expect(result.failure).toEqual({
      classification: "databaseCapabilityMissing",
      reason: "The test database role lacks a required capability.",
    });
    expect(JSON.stringify(result)).not.toContain("password=secret");
    expect(JSON.stringify(result)).not.toContain("production.internal");
  });

  test("CAP-2 classifies permission and migration failures without leaking details", () => {
    const permissionCause = Object.assign(new Error("permission denied for secret-role"), {
      code: "42501",
    });
    const permissionFailure = classifyDatabaseFailure(permissionCause, "setup");
    expect(permissionFailure.classification).toBe("databaseCapabilityMissing");
    expect(permissionFailure.cause).toBe(permissionCause);

    const migrationCause = new Error("migration output contained internal details");
    const migrationFailure = classifyDatabaseFailure(migrationCause, "migration");
    expect(migrationFailure.classification).toBe("migrationFailed");
    expect(migrationFailure.cause).toBe(migrationCause);

    const result = createContractResult({
      capabilityId: "CAP-2",
      acceptanceCriterionId: "AC-0.1-03",
      runIdentity: RUN_IDENTITY,
      fixtureIdentity: `${RUN_IDENTITY}:published:ru`,
      outcome: "setupFailure",
      failure: permissionFailure,
    });
    expect(JSON.stringify(result)).not.toContain("secret-role");
  });

  test("CAP-3 validates run identities before deriving schema or URL", () => {
    expect(validateRunIdentity(RUN_IDENTITY)).toBe(RUN_IDENTITY);
    expect(schemaNameForRunIdentity(RUN_IDENTITY)).toBe("metro_test_unit_story_0_1");
    expect(
      databaseUrlForSchema(
        "postgresql://fixture:fixture@127.0.0.1:5432/metro_test?schema=public",
        "metro_test_unit_story_0_1",
      ),
    ).toContain("schema=metro_test_unit_story_0_1");

    for (const invalid of [
      "Uppercase",
      "contains space",
      "semi;colon",
      "quote'run",
      "double--hyphen",
      "a".repeat(49),
    ]) {
      expect(() => validateRunIdentity(invalid)).toThrow(ContractSafeError);
    }
  });

  test("AC-0.1-01 rejects unsafe database targets before schema setup", () => {
    const safeUrl = "postgresql://tester:secret@localhost:5432/metro_test";

    expect(
      requireTestDatabaseUrl(
        `${safeUrl}?schema=ignored`,
        "postgresql://app:secret@localhost:5432/metro",
      ),
    ).toBe(safeUrl);

    for (const unsafeUrl of [
      "postgresql://tester:secret@production.internal:5432/metro_test",
      "postgresql://tester:secret@localhost:5432/metro",
      "mysql://tester:secret@localhost:3306/metro_test",
    ]) {
      expect(() => requireTestDatabaseUrl(unsafeUrl)).toThrow(ContractSafeError);
    }

    expect(() =>
      requireTestDatabaseUrl(
        "postgresql://tester:secret@127.0.0.1:5432/metro_test",
        "postgresql://app:different-secret@localhost:5432/metro_test",
      ),
    ).toThrow(ContractSafeError);
  });

  test("CAP-3 retains test and cleanup failures together", () => {
    const testFailure = new Error("test body failed");
    const cleanupFailure = new Error("cleanup failed");
    const combined = combineFixtureFailures(testFailure, cleanupFailure);

    expect(combined.errors).toEqual([testFailure, cleanupFailure]);
  });

  test("preserves the setup classification when cleanup also fails", () => {
    const failure = new ContractSafeError(
      "databaseUnavailable",
      "The dedicated test database is unavailable.",
      {
        cleanupFailure: {
          classification: "cleanupFailed",
          reason: "The isolated test schema cleanup failed.",
        },
      },
    );

    expect(failure.classification).toBe("databaseUnavailable");
    expect(failure.cleanupFailure).toEqual({
      classification: "cleanupFailed",
      reason: "The isolated test schema cleanup failed.",
    });
  });
});
