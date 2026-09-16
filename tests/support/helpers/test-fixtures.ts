import type { PrismaClient } from "@prisma/client";
import {
  ContractSafeError,
  type ContractOutcome,
} from "./contract-result";

export const TEST_LOCALES = ["tr", "en"] as const;
export type TestLocale = (typeof TEST_LOCALES)[number];

export const FIXTURE_SCENARIOS = [
  "draft",
  "published",
  "archive",
  "native",
  "fallback",
  "omitted",
  "invalid",
  "unauthorized",
  "conflict",
  "route-collision",
] as const;
export type FixtureScenario = (typeof FIXTURE_SCENARIOS)[number];

export type FixtureSelection = Readonly<{
  scenario: string;
  locale?: string;
}>;

export type ScenarioFixture = Readonly<{
  identity: string;
  runIdentity: string;
  scenario: FixtureScenario;
  locale: TestLocale | null;
  expectedOutcome: ContractOutcome;
  state: Readonly<Record<string, string | number | boolean | null>>;
}>;

const RUN_IDENTITY = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MIN_RUN_IDENTITY_LENGTH = 3;
const MAX_RUN_IDENTITY_LENGTH = 48;
const scenarioLookup: Record<FixtureScenario, true> = {
  draft: true,
  published: true,
  archive: true,
  native: true,
  fallback: true,
  omitted: true,
  invalid: true,
  unauthorized: true,
  conflict: true,
  "route-collision": true,
};
const localeLookup: Record<TestLocale, true> = {
  tr: true,
  en: true,
};

export function validateRunIdentity(value: string): string {
  if (
    value.length < MIN_RUN_IDENTITY_LENGTH ||
    value.length > MAX_RUN_IDENTITY_LENGTH ||
    !RUN_IDENTITY.test(value)
  ) {
    throw new ContractSafeError(
      "invalidInput",
      "Run identity must be 3-48 lowercase letters, digits, or single hyphen-delimited segments.",
    );
  }
  return value;
}

function validateScenario(value: string): FixtureScenario {
  if (!Object.hasOwn(scenarioLookup, value)) {
    throw new ContractSafeError("unsupportedFixture", "Fixture scenario is not supported.");
  }
  return value as FixtureScenario;
}

function validateLocale(value: string | undefined): TestLocale | undefined {
  if (value === undefined) return undefined;
  if (!Object.hasOwn(localeLookup, value)) {
    throw new ContractSafeError("unsupportedFixture", "Fixture locale is not supported.");
  }
  return value as TestLocale;
}

function requireLocale(
  scenario: FixtureScenario,
  locale: TestLocale | undefined,
): TestLocale {
  if (locale === undefined) {
    throw new ContractSafeError(
      "invalidInput",
      `Fixture scenario ${scenario} requires a supported locale.`,
    );
  }
  return locale;
}

export function buildScenarioFixture(
  runIdentityInput: string,
  selection: FixtureSelection,
): ScenarioFixture {
  const runIdentity = validateRunIdentity(runIdentityInput);
  const scenario = validateScenario(selection.scenario);
  const selectedLocale = validateLocale(selection.locale);

  if (scenario === "invalid") {
    if (selectedLocale !== undefined) {
      throw new ContractSafeError(
        "invalidInput",
        "The invalid-locale fixture must not receive a supported locale.",
      );
    }
    return {
      identity: `${runIdentity}:invalid:none`,
      runIdentity,
      scenario,
      locale: null,
      expectedOutcome: "invalid",
      state: {
        family: "locale-resolution",
        resolution: "invalid",
        requestedLocale: null,
      },
    };
  }

  const locale = requireLocale(scenario, selectedLocale);

  if (scenario === "fallback" && locale === "tr") {
    throw new ContractSafeError(
      "invalidInput",
      "The Turkish source locale cannot be its own fallback fixture.",
    );
  }

  const identity = `${runIdentity}:${scenario}:${locale}`;

  switch (scenario) {
    case "draft":
    case "published":
    case "archive":
      return {
        identity,
        runIdentity,
        scenario,
        locale,
        expectedOutcome: "ok",
        state: { family: "content-lifecycle", lifecycle: scenario, locale },
      };
    case "native":
      return {
        identity,
        runIdentity,
        scenario,
        locale,
        expectedOutcome: "ok",
        state: {
          family: "locale-resolution",
          resolution: "native",
          requestedLocale: locale,
          servedLocale: locale,
          fallbackApplied: false,
        },
      };
    case "fallback":
      return {
        identity,
        runIdentity,
        scenario,
        locale,
        expectedOutcome: "ok",
        state: {
          family: "locale-resolution",
          resolution: "fallback",
          requestedLocale: locale,
          servedLocale: "tr",
          fallbackApplied: true,
        },
      };
    case "omitted":
      return {
        identity,
        runIdentity,
        scenario,
        locale,
        expectedOutcome: "notFound",
        state: {
          family: "locale-resolution",
          resolution: "omitted",
          requestedLocale: locale,
          servedLocale: null,
        },
      };
    case "unauthorized":
      return {
        identity,
        runIdentity,
        scenario,
        locale,
        expectedOutcome: "forbidden",
        state: {
          family: "authorization-concurrency",
          authority: "missing",
          expectedStatus: 403,
        },
      };
    case "conflict":
      return {
        identity,
        runIdentity,
        scenario,
        locale,
        expectedOutcome: "conflict",
        state: {
          family: "authorization-concurrency",
          expectedVersion: 1,
          actualVersion: 2,
        },
      };
    case "route-collision":
      return {
        identity,
        runIdentity,
        scenario,
        locale,
        expectedOutcome: "conflict",
        state: {
          family: "route-collision",
          collision: "normalized-equivalent",
          expectedStatus: 409,
        },
      };
  }
}

export function buildFixtureMatrix(runIdentity: string): ScenarioFixture[] {
  const fixtures: ScenarioFixture[] = [];

  for (const locale of TEST_LOCALES) {
    for (const scenario of [
      "draft",
      "published",
      "archive",
      "native",
      "omitted",
      "unauthorized",
      "conflict",
      "route-collision",
    ] as const) {
      fixtures.push(buildScenarioFixture(runIdentity, { scenario, locale }));
    }
  }

  for (const locale of ["en"] as const) {
    fixtures.push(buildScenarioFixture(runIdentity, { scenario: "fallback", locale }));
  }

  fixtures.push(buildScenarioFixture(runIdentity, { scenario: "invalid" }));
  return fixtures;
}

async function assertFixtureOwnership(client: PrismaClient, runIdentity: string) {
  try {
    const owners = await client.$queryRaw<Array<{ run_identity: string }>>`
      SELECT run_identity
      FROM "_metro_test_owner"
      WHERE singleton = TRUE
      LIMIT 1
    `;

    if (owners.length !== 1 || owners[0].run_identity !== runIdentity) {
      throw new ContractSafeError(
        "ownershipMismatch",
        "Fixture schema ownership does not match the requested run.",
      );
    }
  } catch (error) {
    if (error instanceof ContractSafeError) throw error;
    throw new ContractSafeError(
      "ownershipMismatch",
      "Fixture schema ownership could not be verified.",
      { cause: error },
    );
  }
}

export async function seedScenarioFixtures(
  client: PrismaClient,
  runIdentityInput: string,
  selections?: readonly FixtureSelection[],
): Promise<ScenarioFixture[]> {
  const runIdentity = validateRunIdentity(runIdentityInput);
  const fixtures = selections
    ? selections.map((selection) => buildScenarioFixture(runIdentity, selection))
    : buildFixtureMatrix(runIdentity);

  await assertFixtureOwnership(client, runIdentity);

  await client.$transaction(
    fixtures.map((fixture) =>
      client.$executeRaw`
        INSERT INTO "_metro_story_0_1_fixture" (fixture_identity, scenario, locale, payload)
        VALUES (
          ${fixture.identity},
          ${fixture.scenario},
          ${fixture.locale},
          ${JSON.stringify(fixture.state)}::jsonb
        )
        ON CONFLICT (fixture_identity)
        DO UPDATE SET
          scenario = EXCLUDED.scenario,
          locale = EXCLUDED.locale,
          payload = EXCLUDED.payload
      `,
    ),
  );

  return fixtures;
}

export async function listPersistedFixtureIdentities(
  client: PrismaClient,
): Promise<string[]> {
  const rows = await client.$queryRaw<Array<{ fixture_identity: string }>>`
    SELECT fixture_identity
    FROM "_metro_story_0_1_fixture"
    ORDER BY fixture_identity ASC
  `;
  return rows.map((row) => row.fixture_identity);
}
