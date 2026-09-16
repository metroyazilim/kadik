import { createHash } from "node:crypto";

/**
 * Story 6.3 CAP-2: idempotency window a duplicate/retried contact
 * submission (double-click, network retry, back-button resubmit) falls
 * into. A genuinely new submission of the same content after this window
 * is treated as a new message, not blocked.
 */
export const SUBMISSION_IDEMPOTENCY_WINDOW_MS = 10 * 60 * 1000;

export type ContactSubmissionFields = Readonly<{
  locale: string;
  name: string;
  email: string;
  phone: string | null;
  subject: string | null;
  message: string;
}>;

/**
 * Deterministic sha256 of the normalized submission fields plus a coarse
 * time bucket. Two identical submissions within the same
 * `SUBMISSION_IDEMPOTENCY_WINDOW_MS` bucket hash to the same value -
 * `createMessage` (`lib/content.ts`) relies on the resulting unique-index
 * violation to detect and absorb the duplicate without ever comparing rows
 * itself. `email` is lower-cased (case-insensitive identity), every field
 * trimmed; `phone`/`subject` normalize `null` and `""` to the same empty
 * marker so an omitted optional field cannot be distinguished from an
 * empty one for hashing purposes.
 */
export function computeSubmissionHash(
  fields: ContactSubmissionFields,
  nowMs: number = Date.now(),
): string {
  const bucket = Math.floor(nowMs / SUBMISSION_IDEMPOTENCY_WINDOW_MS);
  const material = [
    fields.locale.trim(),
    fields.name.trim(),
    fields.email.trim().toLowerCase(),
    (fields.phone ?? "").trim(),
    (fields.subject ?? "").trim(),
    fields.message.trim(),
    String(bucket),
  ].join("|");
  return createHash("sha256").update(material).digest("hex");
}
