/**
 * `saveDraft` and `publish` never expose a raw database driver error, stack
 * trace, or constraint/query detail to a caller: every non-`ContentModelError`
 * failure they encounter is normalized to `"internal"` with a fixed safe
 * message before it leaves those functions. `classification` and `message`
 * are the safe, stable surface a caller may act on or display. `cause` (when
 * present) preserves the original error for server-side logging only - it is
 * never part of the safe surface and must never be serialized back to a
 * caller. This normalization is a property of `saveDraft`/`publish`
 * specifically, not a blanket guarantee for every function in this module -
 * a bare Prisma call outside those two (e.g. `model.ts`'s plain `.create()`
 * calls, or `backfill.ts`'s direct `port.recordMapping` call) can still
 * propagate an unclassified error to its own caller.
 */
export type ContentModelFailureClassification = "invalidInput" | "internal" | "notFound";

export class ContentModelError extends Error {
  readonly classification: ContentModelFailureClassification;

  constructor(
    classification: ContentModelFailureClassification,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "ContentModelError";
    this.classification = classification;
  }
}
