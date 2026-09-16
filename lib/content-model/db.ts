import type { Prisma, PrismaClient } from "@prisma/client";

/**
 * Every content-model write helper (`createEntity`/`createTranslation`,
 * `saveDraft`/`publish`) and the persisted mapping port accept either the
 * top-level `PrismaClient` or an already-open `Prisma.TransactionClient`.
 * This lets a caller (e.g. `runDomainBackfill`) compose several of these
 * calls into one outer `$transaction` boundary - Prisma does not support
 * nesting a `$transaction` call inside another, so passing the same `tx`
 * through every call is the only way to share one transaction across them.
 */
export type Db = PrismaClient | Prisma.TransactionClient;

/**
 * `Prisma.TransactionClient` deliberately omits `$transaction` (among other
 * top-level-only methods) - so its absence is both the type-level and the
 * runtime-correct way to detect "already inside a transaction".
 */
function isTopLevelClient(client: Db): client is PrismaClient {
  return typeof (client as PrismaClient).$transaction === "function";
}

/**
 * Runs `fn` inside a transaction. Given the top-level `PrismaClient`, opens
 * a new `$transaction` as usual. Given an already-open `Prisma.TransactionClient`,
 * runs `fn` directly against it instead of nesting - the caller's own
 * `$transaction` remains the sole commit/rollback boundary.
 */
export async function withTransaction<T>(
  client: Db,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  if (isTopLevelClient(client)) return client.$transaction(fn);
  return fn(client);
}
