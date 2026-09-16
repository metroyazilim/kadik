import type { Message, MessageStatus, Prisma } from "@prisma/client";
import { assertAdminContext, type AdminContext } from "./admin-context";
import { withTransaction, type MaybeTransactionClient } from "./publishing";
import { ContentModelError } from "./errors";

/**
 * Closed audit metadata shape for a message status transition - mirrors
 * `audit-recorder.ts`'s `ContentAuditMetadata` intentionally: an exact,
 * closed type (not `Prisma.InputJsonValue`) so TypeScript enforces at
 * every call site that name/email/phone/subject/message can never widen
 * into it (CAP-7/CAP-8 - PII never reaches the audit trail).
 */
export type MessageAuditMetadata = Readonly<{
  priorStatus: MessageStatus;
  nextStatus: MessageStatus;
  version: number;
}>;

export type MessageAuditEvent = Readonly<{
  action: "message.status.changed";
  entity: "Message";
  entityId: string;
  metadata: MessageAuditMetadata;
}>;

/** Internal-only signal aborting the transaction on a lost optimistic-concurrency race - same mechanism as `publishing.ts`'s `ConcurrencyConflict`. */
class MessageStatusConflict extends Error {}

export type UpdateMessageStatusInput = Readonly<{
  messageId: string;
  expectedVersion: number;
  nextStatus: MessageStatus;
}>;

export type UpdateMessageStatusResult =
  | Readonly<{ ok: true; message: Message }>
  | Readonly<{ ok: false; conflict: true; current: Message }>;

async function writeMessageAudit(
  actorId: string,
  tx: Prisma.TransactionClient,
  event: MessageAuditEvent,
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
 * `Message`'s own admin-mutation entry point (Story 6.3 CAP-5/CAP-6/CAP-7)
 * - the Message-domain analogue of `admin-content-store.ts`'s
 * `adminSaveDraft`/`adminPublish`, since `Message` deliberately never
 * joined the `ContentEntity`/`ContentTranslation` model (it is visitor
 * input, not locale-translatable managed content - see the `Message`
 * model's own schema comment). `assertAdminContext` runs before any query,
 * exactly like the content-model store; the `version` compare-and-swap and
 * conflict shape mirror `publishing.ts`'s `saveDraft`/`publish` byte for
 * byte. Archiving is not a separate function - it is this same call with
 * `nextStatus: "ARCHIVED"`, so it carries the identical CAS/audit
 * guarantee (CAP-6: soft-delete-only, no separate hard-delete code path).
 */
export async function adminUpdateMessageStatus(
  client: MaybeTransactionClient,
  context: AdminContext,
  input: UpdateMessageStatusInput,
): Promise<UpdateMessageStatusResult> {
  assertAdminContext(context);
  try {
    return await withTransaction(client, async (tx) => {
      const current = await tx.message.findUnique({ where: { id: input.messageId } });
      if (!current) {
        throw new ContentModelError("invalidInput", "The message does not exist.");
      }
      if (current.version !== input.expectedVersion) {
        throw new MessageStatusConflict();
      }

      const updated = await tx.message.updateMany({
        where: { id: input.messageId, version: input.expectedVersion },
        data: { status: input.nextStatus, version: { increment: 1 } },
      });
      if (updated.count === 0) throw new MessageStatusConflict();

      const reloaded = await tx.message.findUniqueOrThrow({ where: { id: input.messageId } });

      await writeMessageAudit(context.actorId, tx, {
        action: "message.status.changed",
        entity: "Message",
        entityId: input.messageId,
        metadata: {
          priorStatus: current.status,
          nextStatus: reloaded.status,
          version: reloaded.version,
        },
      });

      return { ok: true as const, message: reloaded };
    });
  } catch (error) {
    if (error instanceof MessageStatusConflict) {
      let current: Message;
      try {
        current = await client.message.findUniqueOrThrow({
          where: { id: input.messageId },
        });
      } catch (reloadError) {
        throw new ContentModelError(
          "internal",
          "The message could not be reloaded after a conflict.",
          { cause: reloadError },
        );
      }
      return { ok: false as const, conflict: true as const, current };
    }
    if (error instanceof ContentModelError) throw error;
    throw new ContentModelError("internal", "The message status update failed unexpectedly.", {
      cause: error,
    });
  }
}
