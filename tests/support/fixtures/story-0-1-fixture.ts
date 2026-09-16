import { createHash } from "node:crypto";
import { test as base } from "@playwright/test";
import {
  cleanupTestDatabase,
  setupTestDatabase,
  type TestDatabase,
} from "../helpers/test-database";
import {
  seedScenarioFixtures,
  type ScenarioFixture,
} from "../helpers/test-fixtures";

export type Story01Fixtures = {
  runIdentity: string;
  testDatabase: TestDatabase;
  scenarioFixtures: ScenarioFixture[];
};

function runIdentityForTest(testId: string, retry: number) {
  const digest = createHash("sha256")
    .update(`${testId}:${retry}`)
    .digest("hex")
    .slice(0, 24);
  return `pw-${digest}-${retry}`;
}
export function combineFixtureFailures(
  testFailure: unknown,
  cleanupFailure: unknown,
): AggregateError {
  return new AggregateError(
    [testFailure, cleanupFailure],
    "The test body and deterministic fixture cleanup both failed.",
  );
}

export const test = base.extend<Story01Fixtures>({
  runIdentity: async ({}, fixtureUse, testInfo) => {
    await fixtureUse(runIdentityForTest(testInfo.testId, testInfo.retry));
  },
  testDatabase: async ({ runIdentity }, fixtureUse) => {
    const database = await setupTestDatabase({ runIdentity });
    let testFailed = false;
    let testFailure: unknown;

    try {
      await fixtureUse(database);
    } catch (error) {
      testFailed = true;
      testFailure = error;
    }

    try {
      await cleanupTestDatabase(database);
    } catch (cleanupFailure) {
      if (testFailed) {
        throw combineFixtureFailures(testFailure, cleanupFailure);
      }
      throw cleanupFailure;
    }

    if (testFailed) throw testFailure;
  },
  scenarioFixtures: async ({ runIdentity, testDatabase }, fixtureUse) => {
    await fixtureUse(await seedScenarioFixtures(testDatabase.client, runIdentity));
  },
});
