import type { ContentLocale, PrismaClient } from "@prisma/client";
import { assertAdminContext, type AdminContext } from "./admin-context";
import { assertCanDeleteContentType } from "./content-permissions";
import { ContentModelError } from "./errors";
import { generateRoute } from "./route-registry";
import { getPublishedRouteCandidates } from "./route-reader";

const LOCALES = ["tr", "en"] as const satisfies readonly ContentLocale[];

/**
 * Story 3.5's dependency-impact facts for one entity, computed before an
 * admin ever sees an archive/delete confirmation - "yönetici etkileri
 * görmeden işlem tamamlanmaz". Mirrors `lib/media/service.ts`'s
 * `MediaUsageReport` shape and purpose for content entities: one read that
 * answers "what breaks if this is archived or deleted", never guessed or
 * assembled ad hoc by a caller.
 */
export type EntityDependencyReport = Readonly<{
  entityId: string;
  contentType: string;
  publishedLocales: readonly ContentLocale[];
  liveRoutes: readonly Readonly<{ locale: ContentLocale; url: string }>[];
  /** True when no other, still-published entity of the same `contentType` exists - archiving/deleting this one would make that collection's Home section and public collection page render empty. */
  isLastPublishedInCollection: boolean;
  /** `MediaUsage` rows this entity itself owns (its own image/gallery/block fields) - cascade-deleted with it, never a delete blocker; shown for admin visibility only. */
  ownMediaUsageCount: number;
}>;

/**
 * The one read every domain's archive/delete confirmation UI calls before
 * showing a confirm action - never assembled ad hoc per domain. Read-only:
 * opens no transaction, accepts no context (visibility, not a mutation
 * capability).
 */
export async function getEntityDependencyReport(
  client: PrismaClient,
  entityId: string,
  contentType: string,
): Promise<EntityDependencyReport> {
  const [translations, routes, ownMediaUsageCount, otherPublishedCount] = await Promise.all([
    client.contentTranslation.findMany({
      where: { entityId, publishedRevisionId: { not: null } },
      select: { locale: true },
    }),
    getPublishedRouteCandidates(client, entityId),
    client.mediaUsage.count({ where: { entityId } }),
    client.contentEntity.count({
      where: {
        contentType,
        archived: false,
        id: { not: entityId },
        translations: { some: { publishedRevisionId: { not: null } } },
      },
    }),
  ]);

  const publishedLocales = LOCALES.filter((locale) => translations.some((t) => t.locale === locale));

  return {
    entityId,
    contentType,
    publishedLocales,
    liveRoutes: routes.map((route) => ({ locale: route.locale, url: generateRoute(route) })),
    isLastPublishedInCollection: publishedLocales.length > 0 && otherPublishedCount === 0,
    ownMediaUsageCount,
  };
}

/**
 * Archiving is V1's preferred safe operation for published or dependent
 * content ("V1 politikası gereği arşivleme önceliklendirilir") - always
 * permitted, but `acknowledgedImpact` must be `true` whenever the report
 * shows any live route or last-in-collection impact, so the confirmation
 * UI cannot silently skip past a real consequence. Toggling `archived` on
 * a `ContentEntity` never touches its published pointers or routes - the
 * entity simply drops out of every collection/list query that filters
 * `archived: false`; existing published translations remain readable by
 * direct id if anything still resolves one (defense-in-depth, not expected
 * to happen once every list/route reader also filters archived entities).
 */
export async function archiveEntityWithDependencyCheck(
  client: PrismaClient,
  context: AdminContext,
  entityId: string,
  contentType: string,
  input: Readonly<{ archived: boolean; acknowledgedImpact: boolean }>,
): Promise<EntityDependencyReport> {
  assertAdminContext(context);
  const report = await getEntityDependencyReport(client, entityId, contentType);

  const hasImpact = report.liveRoutes.length > 0 || report.isLastPublishedInCollection;
  if (input.archived && hasImpact && !input.acknowledgedImpact) {
    throw new ContentModelError(
      "invalidInput",
      "Archiving this record affects live routes or a collection's last published item; impact must be acknowledged first.",
    );
  }

  await client.$transaction(async (tx) => {
    const updated = await tx.contentEntity.updateMany({
      where: { id: entityId, contentType },
      data: { archived: input.archived },
    });
    if (updated.count === 0) {
      throw new ContentModelError("notFound", `Entity '${entityId}' was not found for content type '${contentType}'.`);
    }
    await tx.auditLog.create({
      data: {
        action: input.archived ? "content.archive" : "content.unarchive",
        entity: "ContentEntity",
        entityId,
        userId: context.actorId,
        metadata: { contentType, dependencyReport: report },
      },
    });
  });

  return report;
}

/**
 * Permanent delete. Authorisation comes from the actor's role
 * (`assertCanDeleteContentType`): SUPER_ADMIN/ADMIN may delete any
 * collection record, AUTHOR only the editorial collections.
 *
 * A published record is deleted together with its published translations
 * and live routes - `onDelete: Cascade` on
 * `ContentTranslation`/`ContentRoute`/`MediaUsage.entity` removes every
 * dependent row in the same transaction, so no public address is left
 * pointing at a missing record. The dependency report captured before the
 * delete is written into the audit entry, so what was live at that moment
 * stays reconstructable.
 */
export async function deleteEntityIfSafe(
  client: PrismaClient,
  context: AdminContext,
  entityId: string,
  contentType: string,
): Promise<EntityDependencyReport> {
  assertAdminContext(context);
  await assertCanDeleteContentType(client, context.actorId, contentType);
  const report = await getEntityDependencyReport(client, entityId, contentType);


  await client.$transaction(async (tx) => {
    const deleted = await tx.contentEntity.deleteMany({ where: { id: entityId, contentType } });
    if (deleted.count === 0) {
      throw new ContentModelError("notFound", `Entity '${entityId}' was not found for content type '${contentType}'.`);
    }
    await tx.auditLog.create({
      data: {
        action: "content.delete",
        entity: "ContentEntity",
        entityId: null,
        userId: context.actorId,
        metadata: { contentType, deletedEntityId: entityId, dependencyReport: report },
      },
    });
  });

  return report;
}
