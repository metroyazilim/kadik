"use server";

import { revalidatePath } from "next/cache";
import type { MessageStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { resolveAdminContext } from "@/lib/content-model/admin-context";
import { adminUpdateMessageStatus } from "@/lib/content-model/message-store";
import { ContentModelError } from "@/lib/content-model/errors";

/**
 * Bound to a message id (`.bind(null, messageId)`) and driven by
 * `useActionState` (`MessagesWorkspace.tsx`) - never a redirect-based
 * action, so a conflict never loses the admin's place in the list/detail
 * view (AC-6.3-05/AC-6.3-07: form/list selection preserved).
 */
export type MessageActionState =
  | { status: "idle" }
  | { status: "success" }
  | { status: "conflict"; current: MessageStatus }
  | { status: "error"; message: string };

const STATUS_VALUES = ["UNREAD", "READ", "REPLIED", "PROCESSED", "ARCHIVED", "SPAM"] as const;
const StatusUpdateSchema = z.object({
  expectedVersion: z.coerce.number().int().min(0),
  nextStatus: z.enum(STATUS_VALUES),
});

async function runStatusUpdate(
  messageId: string,
  expectedVersion: number,
  nextStatus: MessageStatus,
): Promise<MessageActionState> {
  const context = await resolveAdminContext();
  try {
    const result = await adminUpdateMessageStatus(prisma, context, {
      messageId,
      expectedVersion,
      nextStatus,
    });
    revalidatePath("/manage/messages");
    revalidatePath(`/manage/messages/${messageId}`);
    // Revalidated on conflict too, not only success: the server action's
    // own revalidation is what repoints the detail page's hidden
    // `expectedVersion` input at the row's current version. Without this,
    // a rejected retry keeps resubmitting the same stale version and
    // conflicts forever - the page never re-renders to pick up the state
    // that actually caused the rejection.
    if (!result.ok) return { status: "conflict", current: result.current.status };
    return { status: "success" };
  } catch (error) {
    if (error instanceof ContentModelError) return { status: "error", message: error.message };
    return { status: "error", message: "Durum güncellenemedi. Lütfen tekrar deneyin." };
  }
}

export async function updateMessageStatusAction(
  messageId: string,
  _previous: MessageActionState,
  formData: FormData,
): Promise<MessageActionState> {
  const input = StatusUpdateSchema.safeParse({
    expectedVersion: formData.get("expectedVersion"),
    nextStatus: formData.get("nextStatus"),
  });
  if (!input.success) return { status: "error", message: "Geçersiz istek." };
  return runStatusUpdate(messageId, input.data.expectedVersion, input.data.nextStatus);
}

/** Soft delete/archive (Story 6.3 CAP-6): the only removal path - there is no hard-delete action. Reuses `updateMessageStatusAction`'s exact CAS/audit guarantee with a fixed target status. */
export async function archiveMessageAction(
  messageId: string,
  _previous: MessageActionState,
  formData: FormData,
): Promise<MessageActionState> {
  const input = z.object({ expectedVersion: z.coerce.number().int().min(0) }).safeParse({
    expectedVersion: formData.get("expectedVersion"),
  });
  if (!input.success) return { status: "error", message: "Geçersiz istek." };
  return runStatusUpdate(messageId, input.data.expectedVersion, "ARCHIVED");
}

export async function updateMessageStatusDirectAction(
  messageId: string,
  expectedVersion: number,
  nextStatus: MessageStatus,
): Promise<MessageActionState> {
  return runStatusUpdate(messageId, expectedVersion, nextStatus);
}
