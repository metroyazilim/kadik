import type { Prisma } from "@prisma/client";
import { assertAdminContext, type AdminContext } from "./admin-context";
import type { ContentAuditEvent } from "./audit-recorder";
import {
  saveDraft as saveDraftInternal,
  publish as publishInternal,
  type MaybeTransactionClient,
  type SaveDraftInput,
  type SaveDraftResult,
  type PublishInput,
  type PublishResult,
} from "./publishing";
import type { RouteRegistrar } from "./route-registry";
import type { OutboxRegistrar } from "./outbox-recorder";

export type AdminSaveDraftInput = Omit<SaveDraftInput, "createdBy">;
export type AdminPublishInput = PublishInput;

/**
 * Writes the safe audit summary `saveDraft`/`publish` hand this store,
 * inside the same transaction as the mutation (per `audit-recorder.ts`'s
 * `AuditRecorder` contract). Reuses the existing `AuditLog` model rather
 * than a parallel table (per Story 0.3's constraints); uses the
 * transaction-scoped client `tx`, never the global `prisma` singleton, so a
 * throw here participates in the same rollback as the mutation.
 */
async function writeContentAudit(
  actorId: string,
  tx: Prisma.TransactionClient,
  event: ContentAuditEvent,
): Promise<void> {
  await tx.auditLog.create({
    data: {
      action: event.action,
      entity: event.entity,
      entityId: event.entityId,
      userId: actorId,
      metadata: event.metadata,
    },
  });
}

/**
 * `AdminContentStore`'s draft-save entry point (Story 0.3 CAP-1/CAP-2).
 * Rejects any `context` not produced by `resolveAdminContext()` before
 * touching the database, then delegates to Story 0.2's `saveDraft` with
 * `createdBy` derived from the verified actor (never accepted from
 * `input`) and an audit hook that commits one `AuditLog` row in the same
 * transaction as the mutation.
 */
export async function adminSaveDraft(
  client: MaybeTransactionClient,
  context: AdminContext,
  input: AdminSaveDraftInput,
): Promise<SaveDraftResult> {
  assertAdminContext(context);
  return saveDraftInternal(
    client,
    { ...input, createdBy: context.actorId },
    (tx, event) => writeContentAudit(context.actorId, tx, event),
  );
}

/**
 * `AdminContentStore`'s publish entry point (Story 0.3 CAP-1/CAP-2). Same
 * actor verification as `adminSaveDraft`; delegates to Story 0.2's
 * `publish` with the same in-transaction audit hook. `route`/`outbox` are
 * Story 0.4/0.5's own reserved, optional hooks on `publish()` itself -
 * forwarded here unchanged so every Epic 3 domain reserves its route and
 * records its outbox tags through this same actor-verified entry point,
 * never by calling `publish()` directly and reimplementing the actor
 * check.
 */
export async function adminPublish(
  client: MaybeTransactionClient,
  context: AdminContext,
  input: AdminPublishInput,
  route?: RouteRegistrar,
  outbox?: OutboxRegistrar,
): Promise<PublishResult> {
  assertAdminContext(context);
  return publishInternal(
    client,
    input,
    (tx, event) => writeContentAudit(context.actorId, tx, event),
    route,
    outbox,
  );
}
