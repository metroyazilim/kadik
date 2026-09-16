import { execFile } from "node:child_process";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { expect, test } from "../support/merged-fixtures";
import {
  ContractSafeError,
  createContractResult,
} from "../support/helpers/contract-result";
import {
  cleanupTestDatabase,
  setupTestDatabase,
} from "../support/helpers/test-database";
import {
  listPersistedFixtureIdentities,
  seedScenarioFixtures,
} from "../support/helpers/test-fixtures";

const execFileAsync = promisify(execFile);

test.use({ runIdentity: "story-0-1-integration" });
test.setTimeout(120_000);

test("CAP-1..CAP-3 use migrated, isolated, ownership-guarded fixtures", async ({
  runIdentity,
  testDatabase,
  scenarioFixtures,
}) => {
  expect(testDatabase.migrationApplied).toBe(true);
  expect(testDatabase.schemaName).toBe(
    `metro_test_${runIdentity.replaceAll("-", "_")}`,
  );

  const migrationRows = await testDatabase.client.$queryRaw<Array<{ count: number }>>`
    SELECT COUNT(*)::int AS count
    FROM "_prisma_migrations"
    WHERE finished_at IS NOT NULL
  `;
  expect(migrationRows[0]?.count).toBeGreaterThan(0);

  const persistedIdentities = await listPersistedFixtureIdentities(testDatabase.client);
  expect(persistedIdentities).toHaveLength(18);
  expect(persistedIdentities).toEqual(
    scenarioFixtures.map((fixture) => fixture.identity).sort(),
  );

  const countBeforeRejectedFixture = persistedIdentities.length;
  await expect(
    seedScenarioFixtures(testDatabase.client, runIdentity, [
      { scenario: "unsupported", locale: "tr" },
    ]),
  ).rejects.toBeInstanceOf(ContractSafeError);
  expect(await listPersistedFixtureIdentities(testDatabase.client)).toHaveLength(
    countBeforeRejectedFixture,
  );

  const conflictFixture = scenarioFixtures.find(
    (fixture) => fixture.scenario === "conflict" && fixture.locale === "tr",
  );
  expect(conflictFixture).toBeDefined();
  const result = createContractResult({
    capabilityId: "CAP-2",
    acceptanceCriterionId: "AC-0.1-03",
    runIdentity,
    fixtureIdentity: conflictFixture!.identity,
    outcome: conflictFixture!.expectedOutcome,
    statusCode: 409,
    failure: new ContractSafeError(
      "conflict",
      "The expected version no longer owns the current pointer.",
    ),
  });
  expect(result).toEqual({
    capabilityId: "CAP-2",
    acceptanceCriterionId: "AC-0.1-03",
    runIdentity,
    fixtureIdentity: conflictFixture!.identity,
    outcome: "conflict",
    statusCode: 409,
    failure: {
      classification: "conflict",
      reason: "The fixture operation conflicted with current state.",
    },
  });

  const peerRunIdentity = `${runIdentity}-peer`;
  const peerDatabase = await setupTestDatabase({ runIdentity: peerRunIdentity });
  try {
    expect(await listPersistedFixtureIdentities(peerDatabase.client)).toEqual([]);
    await seedScenarioFixtures(peerDatabase.client, peerRunIdentity, [
      { scenario: "published", locale: "en" },
    ]);
    expect(await listPersistedFixtureIdentities(peerDatabase.client)).toHaveLength(1);
    expect(await listPersistedFixtureIdentities(testDatabase.client)).toHaveLength(18);

    await expect(
      cleanupTestDatabase({
        runIdentity: peerRunIdentity,
        schemaName: testDatabase.schemaName,
        baseDatabaseUrl: peerDatabase.baseDatabaseUrl,
      }),
    ).rejects.toMatchObject({ classification: "ownershipMismatch" });
    expect(await listPersistedFixtureIdentities(testDatabase.client)).toHaveLength(18);
  } finally {
    expect(await cleanupTestDatabase(peerDatabase)).toBe("dropped");
  }

  expect(await cleanupTestDatabase(peerDatabase)).toBe("alreadyAbsent");
  const peerSchemaRows = await testDatabase.client.$queryRaw<Array<{ exists: boolean }>>`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.schemata
      WHERE schema_name = ${peerDatabase.schemaName}
    ) AS "exists"
  `;
  expect(peerSchemaRows[0]?.exists).toBe(false);
});

test.describe("setup interruption cleanup", () => {
  test.use({ runIdentity: "story-0-1-interruption-observer" });

  test("AC-0.1-05 removes a schema when setup is interrupted", async ({
    testDatabase,
  }) => {
    const interruptedRunIdentity = "story-0-1-interrupted";
    const interruptedSchemaName = `metro_test_${interruptedRunIdentity.replaceAll("-", "_")}`;

    await expect(
      setupTestDatabase({
        runIdentity: interruptedRunIdentity,
        afterSchemaCreated() {
          throw new Error("injected setup interruption");
        },
      }),
    ).rejects.toMatchObject({ classification: "databaseUnavailable" });

    const schemaRows = await testDatabase.client.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.schemata
        WHERE schema_name = ${interruptedSchemaName}
      ) AS "exists"
    `;
    expect(schemaRows[0]?.exists).toBe(false);
  });
});

test.describe("assertion cleanup probe", () => {
  test.use({ runIdentity: "story-0-1-assertion-observer" });

  test("AC-0.1-05 removes a schema after a failing assertion", async ({
    testDatabase,
  }) => {
    const probeRunIdentity = "story-0-1-assertion-probe";
    const probeSchemaName = `metro_test_${probeRunIdentity.replaceAll("-", "_")}`;
    let probeFailure: unknown;

    try {
      await execFileAsync(
        process.execPath,
        [
          resolve("node_modules/@playwright/test/cli.js"),
          "test",
          "--config=playwright.contract.config.ts",
          "probes/story-0-1-assertion-cleanup.spec.ts",
        ],
        {
          cwd: process.cwd(),
          env: {
            ...process.env,
            CI: "",
            RUN_STORY_01_FAILURE_PROBE: "1",
          },
          timeout: 30_000,
          killSignal: "SIGTERM",
          maxBuffer: 4 * 1024 * 1024,
        },
      );
    } catch (error) {
      probeFailure = error;
    }
    expect(probeFailure).toMatchObject({ code: 1 });

    const schemaRows = await testDatabase.client.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.schemata
        WHERE schema_name = ${probeSchemaName}
      ) AS "exists"
    `;
    expect(schemaRows[0]?.exists).toBe(false);
  });
});
