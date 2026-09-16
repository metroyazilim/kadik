import type { ContentLocale, Prisma } from "@prisma/client";

/**
 * Safe, append-only audit event shape written by `AdminContentStore` (Story
 * 0.3) for a successful content-model mutation. `metadata` is an exact,
 * closed shape - not `Prisma.InputJsonValue` - so a future caller cannot
 * widen it to carry the mutation's raw payload, a secret, or any other
 * field beyond this pointer/version summary; TypeScript enforces the
 * boundary at every call site, not just at this declaration.
 */
export type ContentAuditMetadata = Readonly<{
  locale: ContentLocale;
  priorDraftRevisionId: string | null;
  nextDraftRevisionId: string | null;
  priorPublishedRevisionId: string | null;
  nextPublishedRevisionId: string | null;
  version: number;
}>;

export type ContentAuditEvent = Readonly<{
  action: "content.draft.save" | "content.publish";
  entity: "ContentTranslation";
  entityId: string;
  metadata: ContentAuditMetadata;
}>;

/**
 * Invoked by `saveDraft`/`publish` (`./publishing.ts`) *inside* their own
 * `$transaction`, immediately after the mutation succeeds but before the
 * transaction resolves - so a throw here rolls back the mutation itself
 * (revision insert / pointer swap) along with the audit write, per
 * AC-0.3-03. `publishing.ts` only knows this callback shape; it never
 * imports the `AuditLog` model or `AdminContext` - that is
 * `admin-content-store.ts`'s job, keeping the dependency direction one-way.
 */
export type AuditRecorder = (
  tx: Prisma.TransactionClient,
  event: ContentAuditEvent,
) => Promise<void>;
