import type { ContentLocale, PrismaClient } from "@prisma/client";
import { assertAdminContext, type AdminContext } from "./admin-context";
import { createEntity, createTranslation } from "./model";
import { ContentModelError } from "./errors";

const LOCALES = ["tr", "en"] as const satisfies readonly ContentLocale[];

export type LocaleStatus = "missing" | "draft" | "published";

function localeStatusOf(translation: {
  draftRevisionId: string | null;
  publishedRevisionId: string | null;
} | null): LocaleStatus {
  if (!translation) return "missing";
  if (translation.publishedRevisionId) return "published";
  if (translation.draftRevisionId) return "draft";
  return "missing";
}

export type CollectionRow = Readonly<{
  entityId: string;
  order: number;
  archived: boolean;
  createdAt: Date;
  statuses: Readonly<Record<ContentLocale, LocaleStatus>>;
  /** The first available locale's working payload (draft preferred over
   * published), tried in `LOCALES` order (`tr` first) - callers extract
   * whatever display fields their content type has (title, slug, ...)
   * from this; a row with zero translations is `null` (nothing to show
   * but the entity id, e.g. a freshly created, never-edited entity). */
  displayPayload: unknown | null;
}>;

/** Rows per admin list page. One screenful; deliberately not configurable
 * per domain so every list behaves and costs the same. */
export const COLLECTION_PAGE_SIZE = 20;

export type CollectionPage = Readonly<{
  rows: readonly CollectionRow[];
  total: number;
  page: number;
  perPage: number;
}>;

/**
 * The one list-read query every domain's admin list page
 * (`app/manage/<domain>/page.tsx`) uses - a plain read, never routed
 * through `AdminContentStore` (list is not a mutation). Ordered by the
 * admin's own drag-and-drop `order` first, then by creation time for
 * entities that have never been reordered.
 *
 * Two deliberate cost limits, both load-bearing for admin responsiveness:
 *
 * 1. Only one page of entities is read (`skip`/`take`), never the whole
 *    content type.
 * 2. Only the *display locale's* revision payload is loaded. The other
 *    locales contribute their pointer columns alone, which is all a
 *    status badge needs - so a row costs one payload, not eight, and a
 *    list page does not grow with the size of the body text an editor
 *    happens to have written in Russian.
 */
export async function listCollectionPage(
  client: PrismaClient,
  contentType: string,
  options: { page?: number; perPage?: number; displayLocale?: ContentLocale } = {},
): Promise<CollectionPage> {
  const perPage = options.perPage ?? COLLECTION_PAGE_SIZE;
  const requestedPage = options.page ?? 1;
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? Math.floor(requestedPage) : 1;
  const displayLocale = options.displayLocale ?? "tr";

  const [total, entities] = await Promise.all([
    client.contentEntity.count({ where: { contentType } }),
    client.contentEntity.findMany({
      where: { contentType },
      select: {
        id: true,
        order: true,
        archived: true,
        createdAt: true,
        translations: { select: { locale: true, draftRevisionId: true, publishedRevisionId: true } },
      },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      skip: (page - 1) * perPage,
      take: perPage,
    }),
  ]);

  // One extra bounded query for the display locale's payloads only: at most
  // `perPage` revisions, versus the whole content type's draft *and*
  // published payloads in all four locales that the eager `include` used to
  // pull on every navigation.
  const displayRevisionIds = entities.flatMap((entity) => {
    const translation = entity.translations.find((candidate) => candidate.locale === displayLocale);
    if (!translation) return [];
    const revisionId = translation.draftRevisionId ?? translation.publishedRevisionId;
    return revisionId ? [revisionId] : [];
  });
  const revisions = displayRevisionIds.length
    ? await client.contentTranslationRevision.findMany({
        where: { id: { in: displayRevisionIds } },
        select: { id: true, payload: true },
      })
    : [];
  const payloadByRevisionId = new Map(revisions.map((revision) => [revision.id, revision.payload]));

  const rows = entities.map((entity) => {
    const byLocale = new Map(entity.translations.map((translation) => [translation.locale, translation]));
    const statuses = Object.fromEntries(
      LOCALES.map((locale) => [locale, localeStatusOf(byLocale.get(locale) ?? null)]),
    ) as Record<ContentLocale, LocaleStatus>;
    const display = byLocale.get(displayLocale);
    const displayRevisionId = display ? (display.draftRevisionId ?? display.publishedRevisionId) : null;
    return {
      entityId: entity.id,
      order: entity.order,
      archived: entity.archived,
      createdAt: entity.createdAt,
      statuses,
      displayPayload: displayRevisionId ? (payloadByRevisionId.get(displayRevisionId) ?? null) : null,
    };
  });

  return { rows, total, page, perPage };
}

export type CollectionStats = Readonly<{
  total: number;
  archived: number;
  publishedTranslations: number;
  draftTranslations: number;
}>;

/**
 * The four figures every admin list page shows above its table. All four
 * are `count()` queries against indexed columns, so the header strip costs
 * nothing that grows with content size.
 */
export async function collectionStats(client: PrismaClient, contentType: string): Promise<CollectionStats> {
  const [total, archived, publishedTranslations, draftTranslations] = await Promise.all([
    client.contentEntity.count({ where: { contentType } }),
    client.contentEntity.count({ where: { contentType, archived: true } }),
    client.contentTranslation.count({
      where: { entity: { contentType }, publishedRevisionId: { not: null } },
    }),
    client.contentTranslation.count({
      where: { entity: { contentType }, publishedRevisionId: null, draftRevisionId: { not: null } },
    }),
  ]);
  return { total, archived, publishedTranslations, draftTranslations };
}

export type LocaleTranslationView = Readonly<{
  translationId: string;
  version: number;
  status: LocaleStatus;
  draftRevisionId: string | null;
  publishedRevisionId: string | null;
  draftPayload: unknown | null;
  publishedPayload: unknown | null;
}>;

export type EntityEditView = Readonly<{
  entityId: string;
  contentType: string;
  archived: boolean;
  translations: Readonly<Record<ContentLocale, LocaleTranslationView | null>>;
}>;

/**
 * Hydrates a locale-tabbed edit form: every locale that has a translation
 * row gets its draft revision's payload (if any) as the form's working
 * value, falling back to the published payload when there is no draft yet
 * (e.g. right after a fresh publish). A locale with no translation row at
 * all is `null` - the form lazily creates it on first save, per
 * `service-content-model.md`'s "Service does not need all four locales
 * created up front".
 */
export async function getEntityEditView(
  client: PrismaClient,
  entityId: string,
  contentType: string,
): Promise<EntityEditView | null> {
  const entity = await client.contentEntity.findUnique({
    where: { id: entityId },
    include: {
      translations: {
        include: {
          draftRevision: { select: { payload: true } },
          publishedRevision: { select: { payload: true } },
        },
      },
    },
  });
  if (!entity || entity.contentType !== contentType) return null;

  const byLocale = new Map(entity.translations.map((t) => [t.locale, t]));
  const translations = Object.fromEntries(
    LOCALES.map((locale) => {
      const t = byLocale.get(locale);
      if (!t) return [locale, null];
      const view: LocaleTranslationView = {
        translationId: t.id,
        version: t.version,
        status: localeStatusOf(t),
        draftRevisionId: t.draftRevisionId,
        publishedRevisionId: t.publishedRevisionId,
        draftPayload: t.draftRevision?.payload ?? null,
        publishedPayload: t.publishedRevision?.payload ?? null,
      };
      return [locale, view];
    }),
  ) as Record<ContentLocale, LocaleTranslationView | null>;

  return { entityId: entity.id, contentType: entity.contentType, archived: entity.archived, translations };
}

/**
 * Creates a new locale-independent entity for `contentType`, placed at the
 * end of that content type's current order. No translation is created here
 * - the caller's first `ensureLocaleTranslation` call does that, lazily,
 * for whichever locale the admin starts editing.
 */
export async function createCollectionEntity(
  client: PrismaClient,
  context: AdminContext,
  contentType: string,
): Promise<Readonly<{ entityId: string }>> {
  assertAdminContext(context);
  const count = await client.contentEntity.count({ where: { contentType } });
  const entity = await createEntity(client, { contentType, provenance: "authored" });
  await client.contentEntity.update({ where: { id: entity.id }, data: { order: count } });
  return { entityId: entity.id };
}

/**
 * Returns the existing `(entityId, locale)` translation, creating it first
 * if this is the first time this locale is being edited. Never creates a
 * revision - that is `AdminContentStore.adminSaveDraft`'s job once the
 * admin actually submits the form.
 */
export async function ensureLocaleTranslation(
  client: PrismaClient,
  context: AdminContext,
  entityId: string,
  locale: ContentLocale,
): Promise<Readonly<{ translationId: string; version: number }>> {
  assertAdminContext(context);
  const existing = await client.contentTranslation.findUnique({
    where: { entityId_locale: { entityId, locale } },
    select: { id: true, version: true },
  });
  if (existing) return { translationId: existing.id, version: existing.version };

  const created = await createTranslation(client, { entityId, locale });
  return { translationId: created.id, version: created.version };
}

/**
 * The minimal, honest archive toggle Story 3.1/3.2/3.3/3.4 each expose
 * (`service-content-model.md`'s own scope note: a full dependency-impact UX
 * is Story 3.5's job). Sets `ContentEntity.archived` directly, audited -
 * never a hard delete, never touched by `publishing.ts`.
 */
export async function adminSetArchived(
  client: PrismaClient,
  context: AdminContext,
  entityId: string,
  contentType: string,
  archived: boolean,
): Promise<void> {
  assertAdminContext(context);
  await client.$transaction(async (tx) => {
    const entity = await tx.contentEntity.findUnique({ where: { id: entityId }, select: { contentType: true } });
    if (!entity || entity.contentType !== contentType) {
      throw new ContentModelError("notFound", `No '${contentType}' entity '${entityId}' was found.`);
    }
    await tx.contentEntity.update({ where: { id: entityId }, data: { archived } });
    await tx.auditLog.create({
      data: {
        action: archived ? "content.archive" : "content.unarchive",
        entity: "ContentEntity",
        entityId,
        userId: context.actorId,
        metadata: { contentType },
      },
    });
  });
}
