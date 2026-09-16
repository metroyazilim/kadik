/**
 * Spec 5 §13 step 2: the database-identity/safety-guard primitives every
 * destructive local-database tool shares - the isolated contract/
 * integration harness (`tests/support/helpers/test-database.ts`), the
 * deterministic dev seed's `--reset-demo` path (`prisma/seed.ts`), and the
 * E2E residue cleaner (`scripts/clean-e2e-residue.ts`). Extracted from
 * `test-database.ts` (which used to define all of this privately) so none
 * of the three callers re-derives its own copy of "is this URL safe to run
 * a destructive statement against" - a single, auditable rule set.
 *
 * Pure: no Prisma import, no I/O, no dependency on the test harness or any
 * test-runner. Safe to import from a plain Node script.
 */

export class DatabaseIdentityError extends Error {}

export type DatabaseIdentity = Readonly<{
  hostname: string;
  port: string;
  database: string;
}>;

/**
 * Hostnames a destructive tool is allowed to target: loopback (every
 * spelling normalizes to `"loopback"` below) and the handful of Docker/
 * compose service names this project's local Postgres has used. Never a
 * public/remote hostname - the whole point of this allow-list.
 */
export const SAFE_LOCAL_HOSTS: Readonly<Record<string, true>> = {
  loopback: true,
  postgres: true,
  db: true,
  "test-db": true,
  "test-postgres": true,
};

export function normalizeDatabaseHostname(hostname: string): string {
  const normalized = hostname.toLowerCase().replace(/\.$/, "");
  if (normalized === "localhost" || normalized === "127.0.0.1" || normalized === "[::1]") {
    return "loopback";
  }
  return normalized;
}

export function parsePostgresUrl(value: string, invalidMessage: string): {
  url: URL;
  identity: DatabaseIdentity;
} {
  try {
    const url = new URL(value);
    if (
      (url.protocol !== "postgresql:" && url.protocol !== "postgres:") ||
      !url.hostname ||
      !url.pathname ||
      url.pathname === "/"
    ) {
      throw new Error("Invalid PostgreSQL URL");
    }
    const database = decodeURIComponent(url.pathname.slice(1));
    if (!database || database.includes("/")) {
      throw new Error("Invalid PostgreSQL database name");
    }
    return {
      url,
      identity: {
        hostname: normalizeDatabaseHostname(url.hostname),
        port: url.port || "5432",
        database,
      },
    };
  } catch (error) {
    throw new DatabaseIdentityError(invalidMessage, { cause: error });
  }
}

export function sameDatabaseIdentity(left: DatabaseIdentity, right: DatabaseIdentity): boolean {
  return (
    left.hostname === right.hostname &&
    left.port === right.port &&
    left.database === right.database
  );
}

/**
 * The shared safety gate: `value` must parse as a real PostgreSQL URL whose
 * hostname is in `SAFE_LOCAL_HOSTS`. Does not require any particular
 * database *name* convention (unlike `test-database.ts`'s own additional
 * `TEST_DATABASE_NAME` check, layered on top of this for the isolated test
 * harness specifically) - a destructive tool operating on the ordinary dev
 * database (`DATABASE_URL`, e.g. `metro_dev`) still passes this gate as
 * long as the *host* is local-only.
 */
export function assertLocalDatabaseUrl(value: string, invalidMessage: string): {
  url: URL;
  identity: DatabaseIdentity;
} {
  const parsed = parsePostgresUrl(value, invalidMessage);
  if (!Object.hasOwn(SAFE_LOCAL_HOSTS, parsed.identity.hostname)) {
    throw new DatabaseIdentityError(invalidMessage);
  }
  return parsed;
}
