import "server-only";

import type { ContentLocale, PrismaClient } from "@prisma/client";

/**
 * "Kaydet ve yayınla" is two domain operations behind one button: the draft
 * save creates a new revision and bumps the translation version, so the
 * publish that follows must use the *fresh* pointers, not the stale ones the
 * page was rendered with. This re-reads them and rewrites the form fields
 * the publish actions expect, keeping their optimistic-concurrency checks
 * intact instead of bypassing them.
 */
export async function refreshEditorFormPointers(
  client: PrismaClient,
  formData: FormData,
  entityId: string,
  locale: ContentLocale,
): Promise<FormData> {
  const translation = await client.contentTranslation.findUnique({
    where: { entityId_locale: { entityId, locale } },
    select: { id: true, version: true, draftRevisionId: true },
  });
  if (!translation) return formData;

  formData.set("translationId", translation.id);
  formData.set("expectedVersion", String(translation.version));
  formData.set("draftRevisionId", translation.draftRevisionId ?? "");
  return formData;
}
