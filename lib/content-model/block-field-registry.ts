import { PRODUCT_CONTENT_TYPE, PROJECT_CONTENT_TYPE, POST_CONTENT_TYPE, SERVICE_CONTENT_TYPE } from "./payload-validation";

/**
 * Per-content-type declaration of which payload keys carry an ordered
 * `ContentBlock[]` (`content-blocks.ts`) rather than a flat string or a flat
 * rich-text string (`rich-text-field-registry.ts`). Mirrors that registry's
 * shape and purpose exactly, for the same read-time re-sanitization boundary
 * (`PublicContentReader.resolve()`, Story 5.1 CAP-2) - a block field left out
 * of this registry is read back exactly as written, unsanitized.
 *
 * Team member `bio` and FAQ `answer` are flat rich text, not blocks (short-
 * form single fields with no internal structure) - they belong in
 * `rich-text-field-registry.ts`, not here.
 */
export const BLOCK_FIELDS_BY_CONTENT_TYPE: Readonly<Record<string, readonly string[]>> = {
  [SERVICE_CONTENT_TYPE]: ["blocks"],
  [PRODUCT_CONTENT_TYPE]: ["blocks"],
  [PROJECT_CONTENT_TYPE]: ["challengeBlocks", "solutionBlocks"],
  [POST_CONTENT_TYPE]: ["blocks"],
};

export function blockFieldsFor(contentType: string): readonly string[] {
  return BLOCK_FIELDS_BY_CONTENT_TYPE[contentType] ?? [];
}
