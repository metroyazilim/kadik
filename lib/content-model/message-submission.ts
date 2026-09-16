import type { Message, Prisma, PrismaClient } from "@prisma/client";
import { computeSubmissionHash, type ContactSubmissionFields } from "./message-idempotency";

export type MessageSubmissionInput = ContactSubmissionFields;

/**
 * Idempotent create (Story 6.3 CAP-2), extracted from `lib/content.ts`'s
 * `createMessage` so it can be exercised against an isolated integration-test
 * schema through an explicit `client` parameter, the same seam
 * `content-model`'s other functions use (`lib/content.ts` itself only
 * accepts the global `prisma` singleton, so its own CRUD is
 * E2E-tested against a live server per this codebase's existing
 * convention - CAP-2's race-safety guarantee specifically needs a
 * narrower, client-injectable seam).
 *
 * `submissionHash` is a unique column - a duplicate/retried identical
 * payload inside the same `computeSubmissionHash` time bucket hits a
 * `P2002` constraint violation instead of inserting a second row; the
 * existing row is reloaded and returned as-is, indistinguishable from a
 * fresh success to the caller.
 */
export async function createMessageSubmission(
  client: PrismaClient | Prisma.TransactionClient,
  data: MessageSubmissionInput,
): Promise<Message> {
  const submissionHash = computeSubmissionHash(data);
  try {
    return await client.message.create({ data: { ...data, submissionHash } });
  } catch (error) {
    if (isUniqueConstraintViolation(error)) {
      const existing = await client.message.findUnique({ where: { submissionHash } });
      if (existing) return existing;
    }
    throw error;
  }
}

/**
 * `Prisma.PrismaClientKnownRequestError` is a class from the generated
 * client - checked structurally (`code === "P2002"`) instead of
 * `instanceof` so this module does not need a value import of `Prisma`
 * itself, keeping its only value dependency the Prisma-generated model
 * types already imported above.
 */
function isUniqueConstraintViolation(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("code" in error)) return false;
  return error.code === "P2002";
}
