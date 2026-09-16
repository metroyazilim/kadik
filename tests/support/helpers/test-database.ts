import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import {
  ContractSafeError,
  type FailureClassification,
} from "./contract-result";
import { validateRunIdentity } from "./test-fixtures";
import {
  DatabaseIdentityError,
  parsePostgresUrl,
  sameDatabaseIdentity,
  SAFE_LOCAL_HOSTS,
  type DatabaseIdentity,
} from "@/lib/dev-tools/database-identity";

const execFileAsync = promisify(execFile);
const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const PRISMA_SCHEMA_PATH = resolve(PROJECT_ROOT, "prisma/schema.prisma");
const SCHEMA_PREFIX = "metro_test_";
const CONTRACT_VERSION = "story-0-1-v1";
const TEST_DATABASE_NAME = /(?:^|[-_])test(?:$|[-_])/i;

export type SetupTestDatabaseInput = Readonly<{
  runIdentity: string;
  baseDatabaseUrl?: string;
  afterSchemaCreated?: () => void | Promise<void>;
}>;

export type TestDatabase = Readonly<{
  runIdentity: string;
  schemaName: string;
  baseDatabaseUrl: string;
  databaseUrl: string;
  client: PrismaClient;
  migrationApplied: true;
}>;

export type TestDatabaseCleanupTarget = Pick<
  TestDatabase,
  "runIdentity" | "schemaName" | "baseDatabaseUrl"
> &
  Partial<Pick<TestDatabase, "client">>;

export type CleanupStatus = "dropped" | "alreadyAbsent";

/**
 * Wraps `database-identity.ts`'s generic `DatabaseIdentityError` as this
 * harness's own `ContractSafeError` classification, so every existing
 * caller of this module keeps seeing the same error type it always has -
 * the extraction changes where the guard logic lives, not this harness's
 * observable contract.
 */
function parseTestPostgresUrl(value: string, safeReason: string): { url: URL; identity: DatabaseIdentity } {
  try {
    return parsePostgresUrl(value, safeReason);
  } catch (error) {
    if (error instanceof DatabaseIdentityError) {
      throw new ContractSafeError("invalidInput", safeReason, { cause: error });
    }
    throw error;
  }
}

export function schemaNameForRunIdentity(runIdentityInput: string): string {
  const runIdentity = validateRunIdentity(runIdentityInput);
  return `${SCHEMA_PREFIX}${runIdentity.replaceAll("-", "_")}`;
}

export function databaseUrlForSchema(baseDatabaseUrl: string, schemaName: string): string {
  if (
    schemaName !== "public" &&
    !/^metro_test_[a-z0-9_]{3,48}$/.test(schemaName)
  ) {
    throw new ContractSafeError("invalidInput", "The test schema name is invalid.");
  }
  const { url } = parseTestPostgresUrl(
    baseDatabaseUrl,
    "The dedicated test database URL is invalid.",
  );
  url.searchParams.set("schema", schemaName);
  return url.toString();
}

export function requireTestDatabaseUrl(
  value: string | undefined = process.env.TEST_DATABASE_URL,
  productionDatabaseUrl: string | undefined = process.env.DATABASE_URL,
): string {
  if (!value) {
    throw new ContractSafeError(
      "databaseUnavailable",
      "TEST_DATABASE_URL is required for isolated database fixtures.",
    );
  }

  const testTarget = parseTestPostgresUrl(
    value,
    "The dedicated test database URL is invalid.",
  );
  if (
    !Object.hasOwn(SAFE_LOCAL_HOSTS, testTarget.identity.hostname) ||
    !TEST_DATABASE_NAME.test(testTarget.identity.database)
  ) {
    throw new ContractSafeError(
      "invalidInput",
      "TEST_DATABASE_URL must identify a local or CI-only test database.",
    );
  }

  if (productionDatabaseUrl) {
    const productionTarget = parseTestPostgresUrl(
      productionDatabaseUrl,
      "DATABASE_URL could not be compared safely with the test target.",
    );
    if (sameDatabaseIdentity(testTarget.identity, productionTarget.identity)) {
      throw new ContractSafeError(
        "invalidInput",
        "TEST_DATABASE_URL must not identify the DATABASE_URL database.",
      );
    }
  }

  testTarget.url.searchParams.delete("schema");
  return testTarget.url.toString();
}

function inspectFailure(error: unknown): string {
  if (error instanceof Error) {
    const candidate = error as Error & {
      code?: string;
      stderr?: string | Buffer;
    };
    return [candidate.code, candidate.message, candidate.stderr?.toString()]
      .filter(Boolean)
      .join(" ");
  }
  return "";
}

export function classifyDatabaseFailure(
  error: unknown,
  phase: "setup" | "migration" | "cleanup",
): ContractSafeError {
  if (error instanceof ContractSafeError) return error;

  const detail = inspectFailure(error);
  const capabilityMissing =
    /(?:P1010|42501|permission denied|must be owner|not authorized)/i.test(detail);

  let classification: FailureClassification;
  let reason: string;

  if (capabilityMissing) {
    classification = "databaseCapabilityMissing";
    reason = "The test database role cannot manage isolated schemas.";
  } else if (phase === "migration") {
    classification = "migrationFailed";
    reason = "Prisma migrations could not be applied to the isolated schema.";
  } else if (phase === "cleanup") {
    classification = "cleanupFailed";
    reason = "The isolated test schema could not be removed.";
  } else {
    classification = "databaseUnavailable";
    reason = "The dedicated test database is unavailable.";
  }

  return new ContractSafeError(classification, reason, { cause: error });
}

function createClient(databaseUrl: string) {
  return new PrismaClient({
    datasourceUrl: databaseUrl,
    errorFormat: "minimal",
  });
}

async function schemaExists(client: PrismaClient, schemaName: string) {
  const rows = await client.$queryRaw<Array<{ exists: boolean }>>`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.schemata
      WHERE schema_name = ${schemaName}
    ) AS "exists"
  `;
  return rows[0]?.exists === true;
}

async function ownershipTableExists(client: PrismaClient, schemaName: string) {
  const rows = await client.$queryRaw<Array<{ exists: boolean }>>`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = ${schemaName}
        AND table_name = '_metro_test_owner'
    ) AS "exists"
  `;
  return rows[0]?.exists === true;
}

async function assertSchemaOwnership(
  client: PrismaClient,
  schemaName: string,
  runIdentity: string,
) {
  if (!(await ownershipTableExists(client, schemaName))) {
    throw new ContractSafeError(
      "ownershipMismatch",
      "The target schema is not owned by the requested fixture run.",
    );
  }

  const rows = await client.$queryRawUnsafe<
    Array<{ run_identity: string; schema_name: string; contract_version: string }>
  >(
    `SELECT run_identity, schema_name, contract_version
     FROM "${schemaName}"."_metro_test_owner"
     WHERE singleton = TRUE
     LIMIT 1`,
  );
  const owner = rows[0];

  if (
    rows.length !== 1 ||
    owner.run_identity !== runIdentity ||
    owner.schema_name !== schemaName ||
    owner.contract_version !== CONTRACT_VERSION
  ) {
    throw new ContractSafeError(
      "ownershipMismatch",
      "The target schema is not owned by the requested fixture run.",
    );
  }
}

async function dropOwnedSchema(
  client: PrismaClient,
  schemaName: string,
  runIdentity: string,
): Promise<CleanupStatus> {
  if (!(await schemaExists(client, schemaName))) return "alreadyAbsent";
  await assertSchemaOwnership(client, schemaName, runIdentity);
  await client.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
  return "dropped";
}

async function createFixtureControlTables(
  client: PrismaClient,
  schemaName: string,
  runIdentity: string,
) {
  await client.$executeRaw`
    CREATE TABLE "_metro_test_owner" (
      singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton),
      schema_name TEXT NOT NULL,
      run_identity TEXT NOT NULL,
      contract_version TEXT NOT NULL
    )
  `;
  await client.$executeRaw`
    INSERT INTO "_metro_test_owner" (singleton, schema_name, run_identity, contract_version)
    VALUES (TRUE, ${schemaName}, ${runIdentity}, ${CONTRACT_VERSION})
  `;
  await client.$executeRaw`
    CREATE TABLE "_metro_story_0_1_fixture" (
      fixture_identity TEXT PRIMARY KEY,
      scenario TEXT NOT NULL,
      locale TEXT,
      payload JSONB NOT NULL
    )
  `;
}

async function applyMigrations(databaseUrl: string) {
  try {
    await execFileAsync(
      "npm",
      ["run", "db:migrate", "--", "--schema", PRISMA_SCHEMA_PATH],
      {
        cwd: PROJECT_ROOT,
        env: { ...process.env, DATABASE_URL: databaseUrl },
        timeout: 120_000,
        maxBuffer: 4 * 1024 * 1024,
      },
    );
  } catch (error) {
    throw classifyDatabaseFailure(error, "migration");
  }
}

export async function setupTestDatabase(
  input: SetupTestDatabaseInput,
): Promise<TestDatabase> {
  const runIdentity = validateRunIdentity(input.runIdentity);
  const schemaName = schemaNameForRunIdentity(runIdentity);
  const baseDatabaseUrl = requireTestDatabaseUrl(input.baseDatabaseUrl);
  const databaseUrl = databaseUrlForSchema(baseDatabaseUrl, schemaName);
  const baseClient = createClient(baseDatabaseUrl);
  let scopedClient: PrismaClient | undefined;
  let schemaCreated = false;

  try {
    await baseClient.$connect();
    if (await schemaExists(baseClient, schemaName)) {
      await dropOwnedSchema(baseClient, schemaName, runIdentity);
    }
    await baseClient.$executeRawUnsafe(`CREATE SCHEMA "${schemaName}"`);
    schemaCreated = true;
    await input.afterSchemaCreated?.();

    await applyMigrations(databaseUrl);

    scopedClient = createClient(databaseUrl);
    await scopedClient.$connect();
    await createFixtureControlTables(scopedClient, schemaName, runIdentity);
    const migrationProof = await scopedClient.$queryRaw<
      Array<{ model_table: string | null }>
    >`SELECT to_regclass('"AdminUser"')::text AS model_table`;
    if (!migrationProof[0]?.model_table) {
      throw new ContractSafeError(
        "migrationFailed",
        "Prisma migrations did not create the expected isolated schema model.",
      );
    }

    return {
      runIdentity,
      schemaName,
      baseDatabaseUrl,
      databaseUrl,
      client: scopedClient,
      migrationApplied: true,
    };
  } catch (error) {
    if (scopedClient) await scopedClient.$disconnect().catch(() => undefined);
    if (schemaCreated) {
      try {
        if (await schemaExists(baseClient, schemaName)) {
          if (await ownershipTableExists(baseClient, schemaName)) {
            await dropOwnedSchema(baseClient, schemaName, runIdentity);
          } else {
            // CREATE SCHEMA succeeded in this call, but control-table creation did not.
            // The in-memory ownership fact is sufficient for compensating this partial setup.
            await baseClient.$executeRawUnsafe(
              `DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`,
            );
          }
        }
      } catch (cleanupError) {
        const classifiedCleanup = classifyDatabaseFailure(cleanupError, "cleanup");
        const classifiedSetup = classifyDatabaseFailure(error, "setup");
        throw new ContractSafeError(
          classifiedSetup.classification,
          classifiedSetup.safeReason,
          {
            cause: error,
            cleanupFailure: {
              classification: classifiedCleanup.classification,
              reason: classifiedCleanup.safeReason,
            },
          },
        );
      }
    }
    throw classifyDatabaseFailure(error, "setup");
  } finally {
    await baseClient.$disconnect().catch(() => undefined);
  }
}

export async function cleanupTestDatabase(
  target: TestDatabaseCleanupTarget,
): Promise<CleanupStatus> {
  const runIdentity = validateRunIdentity(target.runIdentity);
  const expectedSchemaName = schemaNameForRunIdentity(runIdentity);
  if (target.schemaName !== expectedSchemaName) {
    throw new ContractSafeError(
      "ownershipMismatch",
      "Cleanup refused a schema outside the requested run boundary.",
    );
  }

  await target.client?.$disconnect().catch(() => undefined);
  const baseDatabaseUrl = requireTestDatabaseUrl(target.baseDatabaseUrl);
  const baseClient = createClient(baseDatabaseUrl);

  try {
    await baseClient.$connect();
    return await dropOwnedSchema(baseClient, target.schemaName, runIdentity);
  } catch (error) {
    throw classifyDatabaseFailure(error, "cleanup");
  } finally {
    await baseClient.$disconnect().catch(() => undefined);
  }
}
