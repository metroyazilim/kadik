import type { Prisma } from "@prisma/client";
import type { OutboxEvent, OutboxRecorder } from "./outbox-recorder";

/**
 * The one production `OutboxRecorder` implementation, writing directly to
 * `InvalidationOutboxEvent` inside `publish()`'s own transaction (Story
 * 0.5's reserved hook). Every Epic 3 domain's publish call site passes this
 * same recorder - never a bespoke inline one - so the row shape stays
 * identical across content types (mirrors `home-layout.ts`'s own inline
 * `tx.invalidationOutboxEvent.create` call, factored out once two callers
 * need the exact same body).
 */
export const persistedOutboxRecorder: OutboxRecorder = async (
  tx: Prisma.TransactionClient,
  event: OutboxEvent,
) => {
  await tx.invalidationOutboxEvent.create({
    data: {
      sourceEntityId: event.sourceEntityId,
      sourceTranslationId: event.sourceTranslationId,
      locale: event.locale,
      tags: [...event.tags],
    },
  });
};
