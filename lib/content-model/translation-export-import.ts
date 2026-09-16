import type { ContentLocale, Prisma, PrismaClient } from "@prisma/client";
import { ContentModelError } from "./errors";
import { adminPublish, adminSaveDraft } from "./admin-content-store";
import type { RouteCandidate } from "./route-registry";
import { serviceRouteCandidate } from "./service-routes";
import { productRouteCandidate } from "./product-routes";
import { projectRouteCandidate } from "./project-routes";
import { postRouteCandidate } from "./post-routes";
import { teamMemberRouteCandidate } from "./team-routes";
import type { AdminContext } from "./admin-context";
import {
  POST_SCHEMA_VERSION,
  PRODUCT_SCHEMA_VERSION,
  PROJECT_SCHEMA_VERSION,
  SERVICE_SCHEMA_VERSION,
  TEAM_MEMBER_SCHEMA_VERSION,
} from "./payload-validation";

export type TranslationExportBundle = Readonly<{
  contentType: string;
  entityId: string;
  sourceLocale: ContentLocale;
  sourcePayload: unknown;
  targetLocales: readonly ContentLocale[];
}>;

/**
 * Exports a content entity's Turkish (or requested source locale) published/draft payload
 * for external LLM or translation batch workflows (Spec 10).
 */
export async function exportEntityForTranslation(
  client: PrismaClient,
  entityId: string,
  sourceLocale: ContentLocale = "tr",
  targetLocales: readonly ContentLocale[] = ["en"],
): Promise<TranslationExportBundle> {
  const translation = await client.contentTranslation.findUnique({
    where: { entityId_locale: { entityId, locale: sourceLocale } },
    include: { draftRevision: true, publishedRevision: true },
  });

  if (!translation) {
    throw new ContentModelError("notFound", `Entity ${entityId} has no translation for source locale ${sourceLocale}`);
  }

  const payload = translation.draftRevision?.payload ?? translation.publishedRevision?.payload ?? {};

  return {
    contentType: (await client.contentEntity.findUnique({ where: { id: entityId } }))?.contentType ?? "unknown",
    entityId,
    sourceLocale,
    sourcePayload: payload,
    targetLocales,
  };
}

type AtomicImportInput = Readonly<{
  entityId: string;
  translations: Record<string, unknown>; // Global English (`en`) payload
  adminContext: AdminContext;
}>;

/** Collections publish through a locale route; singleton pages and home
 * sections have no per-record address, so they publish without one. */
const ROUTE_CANDIDATE_BY_CONTENT_TYPE: Readonly<
  Record<string, (locale: ContentLocale, slug: string) => RouteCandidate>
> = {
  service: serviceRouteCandidate,
  product: productRouteCandidate,
  project: projectRouteCandidate,
  post: postRouteCandidate,
  "team-member": teamMemberRouteCandidate,
};

/** Translation import must write the same schema version each content
 * validator accepts. The previous blanket `1` happened to work for FAQ and
 * singleton payloads but rejected every current v2 collection revision. */
const SCHEMA_VERSION_BY_CONTENT_TYPE: Readonly<Record<string, number>> = {
  service: SERVICE_SCHEMA_VERSION,
  product: PRODUCT_SCHEMA_VERSION,
  project: PROJECT_SCHEMA_VERSION,
  post: POST_SCHEMA_VERSION,
  "team-member": TEAM_MEMBER_SCHEMA_VERSION,
};

/**
 * Imports translated payloads and publishes them in the same pass: the
 * admin already reviewed the JSON before pasting it, so a second manual
 * publish per locale is pure friction. Collections publish through their
 * locale route (reusing the Turkish slug); singleton pages and home
 * sections publish without one.
 */
export async function importTranslationsAtomically(
  client: PrismaClient,
  input: AtomicImportInput,
): Promise<void> {
  const { entityId, translations, adminContext } = input;
  const requestedLocales = Object.keys(translations);
  const unsupportedLocale = requestedLocales.find((locale) => locale !== "en");
  if (unsupportedLocale) {
    throw new ContentModelError(
      "invalidInput",
      `Only the Global English locale can be imported; received ${unsupportedLocale}.`,
    );
  }
  const locales: readonly ContentLocale[] = requestedLocales.length === 0 ? [] : ["en"];
  // One address per record: the locale already prefixes the public URL
  // (`/en/team/<slug>`), so a translated locale reuses the Turkish slug
  // instead of inventing a translated one that would fork the address.
  const sourceTranslation = await client.contentTranslation.findUnique({
    where: { entityId_locale: { entityId, locale: "tr" } },
    include: { draftRevision: true, publishedRevision: true },
  });
  const sourcePayload = (sourceTranslation?.draftRevision?.payload ??
    sourceTranslation?.publishedRevision?.payload ??
    null) as Record<string, unknown> | null;
  const sourceSlug = typeof sourcePayload?.slug === "string" ? sourcePayload.slug : null;
  const contentType = (await client.contentEntity.findUnique({ where: { id: entityId }, select: { contentType: true } }))?.contentType ?? "";

  for (const locale of locales) {
    const payload = translations[locale];
    if (!payload || typeof payload !== "object") continue;

    const record = payload as Record<string, unknown>;
    if (sourceSlug !== null) record.slug = sourceSlug;

    let translation = await client.contentTranslation.findUnique({
      where: { entityId_locale: { entityId, locale } },
    });

    if (!translation) {
      translation = await client.contentTranslation.create({
        data: {
          entityId,
          locale,
        },
      });
    }
    const saved = await adminSaveDraft(client, adminContext, {
      translationId: translation.id,
      expectedVersion: translation.version,
      schemaVersion: SCHEMA_VERSION_BY_CONTENT_TYPE[contentType] ?? 1,
      payload: payload as Prisma.InputJsonValue,
    });
    if (!saved.ok) continue;

    const buildCandidate: ((locale: ContentLocale, slug: string) => RouteCandidate) | undefined =
      ROUTE_CANDIDATE_BY_CONTENT_TYPE[contentType];
    const routeRegistrar =
      buildCandidate !== undefined && sourceSlug !== null
        ? { candidate: buildCandidate(locale, sourceSlug) }
        : undefined;

    await adminPublish(
      client,
      adminContext,
      {
        translationId: translation.id,
        expectedVersion: saved.translation.version,
        expectedDraftRevisionId: saved.revisionId,
      },
      routeRegistrar,
    );
  }
}
