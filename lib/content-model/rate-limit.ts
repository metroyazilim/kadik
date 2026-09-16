import { createHmac } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import { requireAuthSecret } from "../env";

/**
 * Story 6.3 CAP-3: PostgreSQL-backed fixed-window rate limiter. Never
 * stores the raw identifying value (e.g. a visitor IP) - only a hash of
 * it plus the scope, per the PII-minimization constraint every
 * audit/log surface in this domain follows.
 *
 * Keyed with the server's `AUTH_SECRET` (HMAC, not a bare `sha256`): an
 * IPv4 address is drawn from a space of only ~4.3 billion values and
 * `scope` is a small closed set, so an unkeyed hash of `identifier:scope`
 * would be trivially reversible by brute force for anyone who reads the
 * `ContactRateLimit.bucketKey` column (DB access, a backup, a future
 * SQL-adjacent bug) - defeating the PII-minimization intent. Reusing the
 * existing admin-session secret needs no new configuration and matches
 * this app's only other server-only-secret precedent
 * (`lib/session-token.ts`).
 */
export function hashRateLimitKey(identifier: string, scope: string): string {
  return createHmac("sha256", requireAuthSecret()).update(`${identifier}:${scope}`).digest("hex");
}

export type RateLimitCheckInput = Readonly<{
  scope: string;
  /** Already-hashed via `hashRateLimitKey` - this module never re-hashes. */
  bucketKey: string;
  windowMs: number;
  limit: number;
  now?: Date;
}>;

export type RateLimitCheckResult = Readonly<{ allowed: boolean; count: number }>;

/**
 * Atomic increment-and-check: the `upsert`'s `ON CONFLICT` is the
 * concurrency-safety boundary, not an application-level lock - two
 * concurrent submissions from the same key in the same window both land
 * on the same row and both see a correctly incremented `count`, whichever
 * commits second included. Never throws on the identification side (a
 * caller that could not determine an identifier already degrades to
 * `"unknown"` upstream); a database error here propagates as-is, since
 * `contact-actions.ts` treats any rate-limit-check failure as "reject
 * safely" rather than "silently allow" (fail closed once identification
 * succeeded).
 */
export async function checkRateLimit(
  client: PrismaClient | Prisma.TransactionClient,
  input: RateLimitCheckInput,
): Promise<RateLimitCheckResult> {
  const now = input.now ?? new Date();
  // Fixed window start: `now` truncated down to the nearest `windowMs`
  // boundary - the formula, not a named helper, since it has exactly one
  // call site.
  const windowStart = new Date(Math.floor(now.getTime() / input.windowMs) * input.windowMs);
  const row = await client.contactRateLimit.upsert({
    where: {
      scope_bucketKey_windowStart: {
        scope: input.scope,
        bucketKey: input.bucketKey,
        windowStart,
      },
    },
    create: { scope: input.scope, bucketKey: input.bucketKey, windowStart, count: 1 },
    update: { count: { increment: 1 } },
  });
  return { allowed: row.count <= input.limit, count: row.count };
}

/**
 * Best-effort cleanup of windows old enough that no live check can ever
 * touch them again. Called opportunistically by `checkRateLimit`'s caller
 * (`contact-actions.ts`), never awaited into the rejection path - a
 * cleanup failure must never turn a rate-limit check into a submission
 * failure.
 */
export async function cleanupExpiredRateLimitWindows(
  client: PrismaClient,
  olderThanMs: number,
  now: Date = new Date(),
): Promise<void> {
  await client.contactRateLimit.deleteMany({
    where: { windowStart: { lt: new Date(now.getTime() - olderThanMs) } },
  });
}
