import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { test as base } from "@playwright/test";
import { issueTestAdminContext } from "../../../lib/content-model/admin-context-test-support";
import type { AdminContext } from "../../../lib/content-model/admin-context";
import { ensureSiteSettingsEntity } from "../../../lib/content-model/site-settings-registry";

// Runs in the Playwright test process, not the `next dev` child process -
// loads `.env` itself so it connects to the SAME database the live dev
// server these E2E tests drive is actually using, matching
// `admin-seed-fixture.ts`'s own established precedent.
try {
  process.loadEnvFile();
} catch {
  // No .env file present - fine when DATABASE_URL is supplied directly (CI).
}

/**
 * Spec 5 §6: the one sanctioned way for an E2E test to write into the
 * development database. Every row it creates carries a recognizable
 * marker (`@example.test` emails, `provenance = "e2e-test"` on content
 * entities) `scripts/clean-e2e-residue.ts` can find and remove even if a
 * crashed run skips this fixture's own teardown - but this fixture's own
 * teardown, which always runs (even on test failure, per Playwright's
 * fixture contract), is the primary cleanup path, not that recovery net.
 */
export type E2eData = Readonly<{
  /** The shared Prisma client every helper below uses - exposed so a test
   * that needs one additional read (e.g. inspecting `InvalidationOutboxEvent`)
   * does not open a second connection of its own. */
  client: PrismaClient;
  /** Creates a real `AdminUser` row (email ending `@example.test`) and a
   * tracked `AdminContext` from it. Deleted at teardown. */
  createAdminActor(label: string): Promise<AdminContext>;
  /** Registers a `ContentEntity` this test created (via
   * `createCollectionEntity`/the admin UI) for guaranteed teardown
   * deletion, and best-effort re-stamps its `provenance` to `"e2e-test"`
   * so `scripts/clean-e2e-residue.ts` can also find it if teardown itself
   * is ever skipped (e.g. the process is killed mid-test). */
  trackContentEntity(entityId: string): Promise<void>;
  /** For content created through the admin UI, where no test code ever
   * sees the raw Prisma call: finds the entity id whose most recent
   * `ContentTranslationRevision` payload contains `marker` anywhere (title,
   * name, or any other field), agnostic of content type. Returns `null` if
   * nothing matches yet - callers should already know their own marker is
   * unique (every test builds it from `randomUUID()`). */
  findEntityIdByMarker(marker: string): Promise<string | null>;
  /** Registers a `Message` row's email for teardown deletion. */
  trackMessageEmail(email: string): void;
}>;

export type E2eDataFixtures = { e2eData: E2eData };

let sharedClient: PrismaClient | undefined;
function client(): PrismaClient {
  if (!sharedClient) sharedClient = new PrismaClient();
  return sharedClient;
}


export type SiteSettingsSnapshot = Readonly<{
  translationId: string;
  draftRevisionId: string | null;
  publishedRevisionId: string | null;
  version: number;
  publishedAt: Date | null;
  /** Every revision row that already existed for this translation before
   * the test ran. `saveDraft()` always INSERTs a new, immutable revision
   * row rather than mutating one in place, so repointing the draft/published
   * pointers back to their pre-test values (below) leaves any revision a
   * test created behind as an orphan `scripts/clean-e2e-residue.ts` can
   * never find - it only inspects the revision each pointer currently
   * targets, and by the time the cleaner runs the pointer is already back
   * on the real one. Deleting every revision NOT in this set is the only
   * way to keep AC-5.9's "no E2E-marked ... revision ... remains" promise. */
  existingRevisionIds: readonly string[];
}>;

export async function snapshotSiteSettings(prisma: PrismaClient): Promise<readonly SiteSettingsSnapshot[]> {
  const { entityId } = await ensureSiteSettingsEntity(prisma);
  const translations = await prisma.contentTranslation.findMany({ where: { entityId } });
  const snapshots: SiteSettingsSnapshot[] = [];
  for (const t of translations) {
    const revisions = await prisma.contentTranslationRevision.findMany({ where: { translationId: t.id }, select: { id: true } });
    snapshots.push({
      translationId: t.id,
      draftRevisionId: t.draftRevisionId,
      publishedRevisionId: t.publishedRevisionId,
      version: t.version,
      publishedAt: t.publishedAt,
      existingRevisionIds: revisions.map((r) => r.id),
    });
  }
  return snapshots;
}

export async function restoreSiteSettings(prisma: PrismaClient, snapshot: readonly SiteSettingsSnapshot[]): Promise<void> {
  for (const entry of snapshot) {
    // Repoint before deleting: the FK on draftRevisionId/publishedRevisionId
    // is onDelete: Restrict, so a revision still pointed at cannot be
    // deleted. Once the pointers are back on their pre-test targets, every
    // other revision row for this translation is safely an E2E orphan.
    await prisma.contentTranslation.update({
      where: { id: entry.translationId },
      data: {
        draftRevisionId: entry.draftRevisionId,
        publishedRevisionId: entry.publishedRevisionId,
        version: entry.version,
        publishedAt: entry.publishedAt,
      },
    });
    await prisma.contentTranslationRevision.deleteMany({
      where: { translationId: entry.translationId, id: { notIn: [...entry.existingRevisionIds] } },
    });
  }
}

/**
 * `ContactRateLimit.bucketKey` is an HMAC of the visitor identifier - by
 * design (Story 6.3 CAP-3) it cannot carry a recognizable E2E marker
 * without defeating the PII-minimization property that HMAC exists for,
 * so this table cannot use the marker-based selectivity every other row
 * type in this fixture uses. Row identity is the alternative: snapshot
 * the ids that already exist before the test runs (real visitor windows,
 * if any), then delete whatever ids exist afterwards that were not in
 * that snapshot. A row an in-flight real submission increments during
 * the test keeps its original id, so it is never touched; only windows
 * created fresh during this test are removed. Runs for every test
 * (negligible cost - two small id-only queries), not only tests that
 * intentionally trip the limiter, so a test that hits it incidentally is
 * covered too.
 */
export async function snapshotContactRateLimitIds(prisma: PrismaClient): Promise<ReadonlySet<string>> {
  const rows = await prisma.contactRateLimit.findMany({ select: { id: true } });
  return new Set(rows.map((r) => r.id));
}

export async function deleteNewContactRateLimitRows(prisma: PrismaClient, existingIds: ReadonlySet<string>): Promise<void> {
  const rows = await prisma.contactRateLimit.findMany({ select: { id: true } });
  const newIds = rows.map((r) => r.id).filter((id) => !existingIds.has(id));
  if (newIds.length > 0) {
    await prisma.contactRateLimit.deleteMany({ where: { id: { in: newIds } } });
  }
}

export const test = base.extend<E2eDataFixtures>({
  e2eData: async ({}, fixtureUse) => {
    const prisma = client();
    const siteSettingsSnapshot = await snapshotSiteSettings(prisma);
    const contactRateLimitIds = await snapshotContactRateLimitIds(prisma);

    const adminUserIds: string[] = [];
    const contentEntityIds: string[] = [];
    const messageEmails: string[] = [];


    const e2eData: E2eData = {
      client: prisma,

      async createAdminActor(label: string): Promise<AdminContext> {
        const user = await prisma.adminUser.create({
          data: {
            email: `${label}-${randomUUID()}@example.test`,
            passwordHash: "unused",
            name: "E2E data fixture actor",
          },
        });
        adminUserIds.push(user.id);
        return issueTestAdminContext({ id: user.id, email: user.email });
      },

      async trackContentEntity(entityId: string): Promise<void> {
        contentEntityIds.push(entityId);
        await prisma.contentEntity.update({ where: { id: entityId }, data: { provenance: "e2e-test" } }).catch(() => undefined);
      },

      async findEntityIdByMarker(marker: string): Promise<string | null> {
        const rows = await prisma.$queryRaw<Array<{ entityId: string }>>`
          SELECT ct."entityId" AS "entityId"
          FROM "ContentTranslationRevision" ctr
          JOIN "ContentTranslation" ct ON ct.id = ctr."translationId"
          WHERE ctr.payload::text LIKE '%' || ${marker} || '%'
          ORDER BY ctr."createdAt" DESC
          LIMIT 1
        `;
        return rows[0]?.entityId ?? null;
      },

      trackMessageEmail(email: string): void {
        messageEmails.push(email);
      },
    };

    try {
      await fixtureUse(e2eData);
    } finally {
      // Order matters: content entities/messages/migration rows first
      // (independent of each other), site-settings pointer restore next,
      // admin actors last (nothing above depends on them existing).
      if (contentEntityIds.length > 0) {
        await prisma.contentEntity.deleteMany({ where: { id: { in: contentEntityIds } } }).catch((error) => {
          throw new Error(`e2eData teardown failed to delete tracked content entities: ${String(error)}`);
        });
      }
      if (messageEmails.length > 0) {
        await prisma.message.deleteMany({ where: { email: { in: messageEmails } } }).catch((error) => {
          throw new Error(`e2eData teardown failed to delete tracked messages: ${String(error)}`);
        });
      }

      await restoreSiteSettings(prisma, siteSettingsSnapshot).catch((error) => {
        throw new Error(`e2eData teardown failed to restore the site-settings singleton: ${String(error)}`);
      });
      await deleteNewContactRateLimitRows(prisma, contactRateLimitIds).catch((error) => {
        throw new Error(`e2eData teardown failed to delete new contact rate-limit windows: ${String(error)}`);
      });
      if (adminUserIds.length > 0) {
        await prisma.adminUser.deleteMany({ where: { id: { in: adminUserIds } } }).catch((error) => {
          throw new Error(`e2eData teardown failed to delete tracked admin actors: ${String(error)}`);
        });
      }
    }
  },
});
