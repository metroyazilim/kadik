import type { PrismaClient } from "@prisma/client";
import { assertAdminContext, type AdminContext } from "./admin-context";
import { ContentModelError } from "./errors";

export type ReorderEntitiesInput = Readonly<{
  contentType: string;
  orderedIds: readonly string[];
}>;

/**
 * The only sanctioned way to change `ContentEntity.order` (drag-and-drop
 * reorder, Epic 3). `orderedIds` is the *complete*, de-duplicated list of
 * every entity in `contentType`'s collection, in its new render order - the
 * caller's list UI always submits the whole list after a drag, never a
 * partial delta, so there is no window where two entities could end up
 * sharing a position. Verifies every id actually belongs to `contentType`
 * before writing anything, so a stale or forged id list can never silently
 * reorder (or move into) a different content type's collection. One audited
 * transaction; a throw here changes nothing.
 */
export async function adminReorderEntities(
  client: PrismaClient,
  context: AdminContext,
  input: ReorderEntitiesInput,
): Promise<void> {
  assertAdminContext(context);
  const ids = [...new Set(input.orderedIds)];
  if (ids.length === 0) return;
  if (ids.length !== input.orderedIds.length) {
    throw new ContentModelError("invalidInput", "Reorder request contains a duplicate entity id.");
  }

  await client.$transaction(async (tx) => {
    const rows = await tx.contentEntity.findMany({
      where: { id: { in: ids }, contentType: input.contentType },
      select: { id: true },
    });
    if (rows.length !== ids.length) {
      throw new ContentModelError(
        "invalidInput",
        `One or more entities do not belong to content type '${input.contentType}'.`,
      );
    }

    await Promise.all(
      ids.map((id, index) => tx.contentEntity.update({ where: { id }, data: { order: index } })),
    );

    await tx.auditLog.create({
      data: {
        action: "content.reorder",
        entity: "ContentEntity",
        entityId: null,
        userId: context.actorId,
        metadata: { contentType: input.contentType, orderedIds: ids },
      },
    });
  });
}
