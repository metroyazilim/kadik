import { PrismaClient } from "@prisma/client";
import { assertLocalDatabaseUrl } from "../lib/dev-tools/database-identity";

/**
 * Spec 5 §7/AC-5.12: removes only test-attributable rows a Playwright E2E
 * run left behind in the development database, never real content.
 * `--dry-run` (the default) reports counts and writes nothing; only
 * `--apply` performs the deletion. Refuses to run at all against a
 * `DATABASE_URL` that does not pass the same local-host identity guard
 * every other destructive tool in this repository shares
 * (`lib/dev-tools/database-identity.ts`).
 *
 * Selectivity rules, each independently scoped to a marker no genuine
 * admin-authored row can accidentally carry:
 *
 * 1. `ContentEntity` rows stamped `provenance = "e2e-test"` (the fixed
 *    marker `tests/support/fixtures/e2e-data-fixture.ts` stamps on every
 *    entity it creates) - cascades to their translations/revisions/routes
 *    per the schema's own `onDelete: Cascade` relations, so one delete
 *    call is enough.
 * 2. `AdminUser` rows whose email ends `@example.test`, or whose email
 *    *both* starts with `e2e-` *and* ends `@example.com` - the two E2E
 *    actor conventions already established by `admin-seed-fixture.ts`
 *    (`e2e-<testId>-<uuid>@example.com`) and the `actor()` helpers this
 *    spec's own e2e-file migration consolidates onto the shared fixture
 *    (`<label>-<uuid>@example.test`). The bare-domain `@example.com` half
 *    of this is deliberately never matched alone: this project's real
 *    bootstrap admin (`ADMIN_EMAIL` in `.env`) is itself `admin@example.com`
 *    in local development, and matching the domain without the `e2e-`
 *    prefix would misidentify every genuinely admin-authored row the
 *    deterministic seed (`prisma/seed.ts`) creates as E2E residue. A crash
 *    between actor creation and the fixture's own teardown is the only way
 *    a real E2E actor row survives; this is the recovery path for that
 *    case, not the primary one (the fixture's own teardown is).
 * 3. `Message` rows whose email ends `@example.test` - every contact-form
 *    E2E test already uses that reserved (RFC 2606) TLD for its visitor
 *    email, so this is a zero-risk, assertion-preserving selector; no test
 *    body needed to change for this rule to apply.
 * 4. Singleton-backed content (`site-settings`, every `home-section:*`,
 *    `content-page:*`) whose *published* or *draft* revision's `createdBy`
 *    resolves to an `AdminUser` matching rule 2 - reset (pointers nulled,
 *    orphaned revisions deleted, version zeroed), never entity-deleted,
 *    since the entity/translation rows are shared registry infrastructure
 *    other code expects to always exist. A real admin's `createdBy` never
 *    matches this pattern, so a genuine admin-authored publish is never
 *    touched.
 *
 * Deliberately out of scope for this script: `ContactRateLimit` rows. Its
 * `bucketKey` is an HMAC of the visitor identifier (Story 6.3 CAP-3) - by
 * design it cannot carry a recognizable marker without defeating the
 * PII-minimization property the HMAC exists for, so this table has no
 * selectivity rule here. The rate-limit E2E test's residue is instead
 * cleaned per-test by `tests/support/fixtures/e2e-data-fixture.ts`'s
 * snapshot-before/delete-new-after mechanism (row identity, not a
 * marker), which is the primary path exactly like every other row type
 * above; an orphaned row from a crash this recovery script cannot see
 * still expires via `rate-limit.ts`'s existing best-effort
 * `cleanupExpiredRateLimitWindows` (1-hour retention).
 *
 * Every function below takes its `PrismaClient` as a parameter (rather
 * than closing over a module-level singleton) so `tests/integration/
 * story-5-residue-cleaner.spec.ts` can exercise the exact same selectivity
 * logic against an isolated test schema, not a hand-duplicated copy of it.
 */

export type ResidueCounts = Readonly<{
  contentEntities: number;
  adminUsers: number;
  messages: number;
  singletonTranslationsReset: number;
}>;

export type SingletonTranslationToReset = Readonly<{
  translationId: string;
  /** The published revision id to clear, or `null` if the published
   * pointer was not itself E2E-authored and must be left alone. */
  resetPublishedRevisionId: string | null;
  /** The draft revision id to clear, or `null` if the draft pointer was
   * not itself E2E-authored and must be left alone. */
  resetDraftRevisionId: string | null;
}>;

export type ResidueReport = Readonly<{
  counts: ResidueCounts;
  contentEntityIds: readonly string[];
  adminUserIds: readonly string[];
  messageIds: readonly string[];
  singletonTranslations: readonly SingletonTranslationToReset[];
}>;

async function findE2eAdminUserIds(prisma: PrismaClient): Promise<string[]> {
  const rows = await prisma.adminUser.findMany({
    where: {
      OR: [
        { email: { endsWith: "@example.test" } },
        { AND: [{ email: { startsWith: "e2e-" } }, { email: { endsWith: "@example.com" } }] },
      ],
    },
    select: { id: true },
  });
  return rows.map((row) => row.id);
}

/**
 * Per pointer, not per translation: a translation whose *draft* was
 * authored by an E2E actor but whose *published* pointer is genuinely
 * admin-authored has only its draft cleared - the real, live publish (and
 * its revision) is never touched, even though the translation as a whole
 * shows up in this report.
 */
async function findSingletonTranslationsToReset(
  prisma: PrismaClient,
  e2eAdminUserIds: readonly string[],
): Promise<SingletonTranslationToReset[]> {
  if (e2eAdminUserIds.length === 0) return [];

  const singletonEntities = await prisma.contentEntity.findMany({
    where: {
      OR: [
        { contentType: "site-settings" },
        { contentType: { startsWith: "home-section:" } },
        { contentType: { startsWith: "content-page:" } },
      ],
    },
    select: { id: true },
  });
  const entityIds = singletonEntities.map((row) => row.id);
  if (entityIds.length === 0) return [];

  const translations = await prisma.contentTranslation.findMany({
    where: { entityId: { in: entityIds } },
    select: {
      id: true,
      publishedRevisionId: true,
      draftRevisionId: true,
      publishedRevision: { select: { createdBy: true } },
      draftRevision: { select: { createdBy: true } },
    },
  });

  const e2eActorSet = new Set(e2eAdminUserIds);
  const results: SingletonTranslationToReset[] = [];
  for (const translation of translations) {
    const publishedByE2e = Boolean(translation.publishedRevision && e2eActorSet.has(translation.publishedRevision.createdBy));
    const draftByE2e = Boolean(translation.draftRevision && e2eActorSet.has(translation.draftRevision.createdBy));
    if (!publishedByE2e && !draftByE2e) continue;
    results.push({
      translationId: translation.id,
      resetPublishedRevisionId: publishedByE2e ? translation.publishedRevisionId : null,
      resetDraftRevisionId: draftByE2e ? translation.draftRevisionId : null,
    });
  }
  return results;
}

/** `saveDraft`'s `createdBy` for content authored outside the admin write
 * path (never a real `AdminUser.id`). Any other non-`AdminUser.id` string
 * would be a genuinely new convention worth its own rule, not silently
 * swept up here. */
function isSystemAuthorMarker(author: string): boolean {
  return author.startsWith("legacy-backfill:") || author === "system:bootstrap";
}

/**
 * Rule 5: a regular (non-singleton) `ContentEntity` - Service/Product/
 * Project/Post/TeamMember/FAQ/etc, never `site-settings`/`home-section:*`/
 * `content-page:*` (rule 4 already handles those, by reset rather than
 * delete) - where every revision across every locale translation is
 * attributable to a *non-real* actor: either a still-present E2E-pattern
 * `AdminUser` (rule 2's own set - covers a crash between actor creation
 * and that test's teardown), or a `createdBy` that resolves to no
 * `AdminUser` row at all and is not a known system marker.
 *
 * The dangling case is the common one in practice: `admin-seed-fixture.ts`
 * deletes its own per-test admin actor at teardown regardless of whether
 * the content that actor authored via the real `/manage` UI was itself
 * tracked, so a test file that never calls `e2eData.trackContentEntity()`
 * for everything it creates (or predates that convention entirely) leaves
 * a genuinely `provenance: "authored"` entity - indistinguishable from a
 * human admin's by provenance alone - whose author has since vanished. The
 * application itself never deletes a real `AdminUser` row, so a real
 * admin's authored content can never go dangling this way; only an
 * ephemeral, already-torn-down E2E actor can.
 *
 * An entity with *any* revision authored by a still-existing, non-E2E-
 * pattern admin (a real person), or with no revisions at all, is never
 * matched.
 */
async function findE2eAuthoredEntityIds(
  prisma: PrismaClient,
  e2eAdminUserIds: readonly string[],
): Promise<string[]> {
  const e2eActorSet = new Set(e2eAdminUserIds);
  const realAdminIds = new Set((await prisma.adminUser.findMany({ select: { id: true } })).map((row) => row.id));

  function isNonRealAuthor(author: string): boolean {
    if (e2eActorSet.has(author)) return true;
    if (isSystemAuthorMarker(author)) return false;
    return !realAdminIds.has(author);
  }

  const candidates = await prisma.contentEntity.findMany({
    where: { provenance: { not: "e2e-test" } },
    select: {
      id: true,
      contentType: true,
      translations: {
        select: {
          publishedRevision: { select: { createdBy: true } },
          draftRevision: { select: { createdBy: true } },
        },
      },
    },
  });

  const ids: string[] = [];
  for (const entity of candidates) {
    if (entity.contentType === "site-settings") continue;
    if (entity.contentType.startsWith("home-section:") || entity.contentType.startsWith("content-page:")) continue;
    const authors = entity.translations
      .flatMap((translation) => [translation.publishedRevision?.createdBy, translation.draftRevision?.createdBy])
      .filter((author): author is string => Boolean(author));
    if (authors.length === 0) continue;
    if (authors.every(isNonRealAuthor)) ids.push(entity.id);
  }
  return ids;
}

export async function computeResidueReport(prisma: PrismaClient): Promise<ResidueReport> {
  const markedEntities = await prisma.contentEntity.findMany({
    where: { provenance: "e2e-test" },
    select: { id: true },
  });
  const adminUserIds = await findE2eAdminUserIds(prisma);
  const e2eAuthoredEntityIds = await findE2eAuthoredEntityIds(prisma, adminUserIds);
  const contentEntityIds = [...new Set([...markedEntities.map((row) => row.id), ...e2eAuthoredEntityIds])];
  const messages = await prisma.message.findMany({
    where: { email: { endsWith: "@example.test" } },
    select: { id: true },
  });
  const singletonTranslations = await findSingletonTranslationsToReset(prisma, adminUserIds);

  return {
    counts: {
      contentEntities: contentEntityIds.length,
      adminUsers: adminUserIds.length,
      messages: messages.length,
      singletonTranslationsReset: singletonTranslations.length,
    },
    contentEntityIds,
    adminUserIds,
    messageIds: messages.map((row) => row.id),
    singletonTranslations,
  };
}

async function resetSingletonTranslation(prisma: PrismaClient, translation: SingletonTranslationToReset): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const data: { draftRevisionId?: null; publishedRevisionId?: null; publishedAt?: null } = {};
    if (translation.resetDraftRevisionId !== null) data.draftRevisionId = null;
    if (translation.resetPublishedRevisionId !== null) {
      data.publishedRevisionId = null;
      data.publishedAt = null;
    }
    await tx.contentTranslation.update({ where: { id: translation.translationId }, data });

    const revisionIds = [translation.resetPublishedRevisionId, translation.resetDraftRevisionId].filter(
      (id): id is string => id !== null,
    );
    if (revisionIds.length > 0) {
      await tx.contentTranslationRevision.deleteMany({ where: { id: { in: revisionIds } } });
    }
  });
}

/** Applies exactly what `report` describes - never re-derives its own selection, so a test asserting on `report` and then calling this is asserting on precisely what gets deleted. */
export async function applyResidueCleanup(prisma: PrismaClient, report: ResidueReport): Promise<void> {
  if (report.contentEntityIds.length > 0) {
    await prisma.contentEntity.deleteMany({ where: { id: { in: [...report.contentEntityIds] } } });
  }
  if (report.messageIds.length > 0) {
    await prisma.message.deleteMany({ where: { id: { in: [...report.messageIds] } } });
  }
  for (const translation of report.singletonTranslations) {
    await resetSingletonTranslation(prisma, translation);
  }
  if (report.adminUserIds.length > 0) {
    await prisma.adminUser.deleteMany({ where: { id: { in: [...report.adminUserIds] } } });
  }
}

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const prisma = new PrismaClient();

  try {
    assertLocalDatabaseUrl(
      process.env.DATABASE_URL ?? "",
      "The residue cleaner refuses to run against a database that is not identifiably local.",
    );

    const report = await computeResidueReport(prisma);

    console.log(`clean-e2e-residue ${apply ? "(applying)" : "(dry-run - pass --apply to delete)"}`);
    console.log(`  ContentEntity (provenance="e2e-test", or every revision E2E-authored; cascades translations/revisions/routes): ${report.counts.contentEntities}`);
    console.log(`  AdminUser (@example.test / @example.com): ${report.counts.adminUsers}`);
    console.log(`  Message (@example.test): ${report.counts.messages}`);
    console.log(`  Singleton content translations to reset (site-settings/home-section/content-page published or drafted by an E2E actor): ${report.counts.singletonTranslationsReset}`);

    if (!apply) {
      console.log("Dry run: nothing was deleted.");
      return;
    }

    await applyResidueCleanup(prisma, report);
    console.log("Residue removed.");
  } finally {
    await prisma.$disconnect();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
