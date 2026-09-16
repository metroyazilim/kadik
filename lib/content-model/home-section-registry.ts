import { Prisma, type PrismaClient } from "@prisma/client";
import type { HomeSectionKey } from "@prisma/client";
export type { HomeSectionKey };

import { ContentModelError } from "./errors";

/**
 * The closed set of Home sections (Story 2.1, AC-2.1-01). This array's
 * order is also the *default* global render order used when the registry
 * is bootstrapped for the first time - it mirrors the fixed section order
 * `components/HomeComposed.tsx` renders on the public homepage.
 *
 * This is the only place a new section key could ever be added, and doing
 * so is a code change (plus a `HomeSectionKey` enum migration), never a
 * runtime admin action - per AD-2, free-form section creation is out of
 * scope for V1.
 */
export const HOME_SECTION_KEYS = [
  "hero",
  "about",
  "brandTrust",
  "services",
  "process",
  "achievements",
  "projects",
  "marquee",
  "team",
  "testimonials",
  "blog",
] as const satisfies readonly HomeSectionKey[];

const HOME_SECTION_KEY_LOOKUP: Readonly<Record<string, true>> = Object.fromEntries(
  HOME_SECTION_KEYS.map((key) => [key, true as const]),
);

export type HomeSectionLocaleStatus = "published" | "draft" | "missing";

export function isHomeSectionKey(value: unknown): value is HomeSectionKey {
  return typeof value === "string" && HOME_SECTION_KEY_LOOKUP[value] === true;
}

/** Turkish display labels for the admin registry UI. */
export const HOME_SECTION_LABELS: Readonly<Record<HomeSectionKey, string>> = {
  hero: "Hero Section",
  about: "Hakkımızda",
  brandTrust: "Marka Güveni",
  services: "Hizmetler",
  process: "Süreç",
  achievements: "Başarılar",
  projects: "Projeler",
  marquee: "Kayan Yazı",
  team: "Ekip",
  testimonials: "Referanslar",
  blog: "Blog",
};

const HOME_SECTION_CONTENT_TYPE_PREFIX = "home-section:";

/**
 * Encodes a Home section's registry key into the `contentType` its backing
 * `ContentEntity` carries. This is what lets Story 2.2's section content
 * reuse `saveDraft`/`publish`/`getPublished` (Story 0.2/0.3) completely
 * unmodified - to those functions a Home section is just another content
 * type, dispatched through `payload-validation.ts`'s existing extension
 * pattern (one `case` branch per content type).
 */
export function homeSectionContentType(key: HomeSectionKey): string {
  return `${HOME_SECTION_CONTENT_TYPE_PREFIX}${key}`;
}

/**
 * Inverse of `homeSectionContentType`. Returns `null` for any content type
 * that is not a Home section's (including one whose suffix is not a
 * registered key) - callers must treat `null` as "not a Home section",
 * never throw, since this is used by generic content-type dispatch that
 * also serves non-Home content.
 */
export function homeSectionKeyFromContentType(contentType: string): HomeSectionKey | null {
  if (!contentType.startsWith(HOME_SECTION_CONTENT_TYPE_PREFIX)) return null;
  const candidate = contentType.slice(HOME_SECTION_CONTENT_TYPE_PREFIX.length);
  return isHomeSectionKey(candidate) ? candidate : null;
}

export const HOME_LAYOUT_SCHEMA_VERSION = 1;

export type HomeLayoutSectionEntry = Readonly<{
  key: HomeSectionKey;
  enabled: boolean;
}>;

/** The layout payload a freshly-bootstrapped registry starts with. */
export function defaultHomeLayoutPayload(): readonly HomeLayoutSectionEntry[] {
  return HOME_SECTION_KEYS.map((key) => ({ key, enabled: true }));
}

/**
 * Validates a `HomeLayoutRevision.payload` candidate (AC-2.1-04): it must
 * be, for the supported `schemaVersion`, an array containing every one of
 * the eleven registry keys exactly once, each paired with a boolean
 * `enabled`. Array position is the global order. Rejects wrong version,
 * non-array input, wrong length, duplicate keys, unknown keys, and
 * non-boolean `enabled` - all as a safe `ContentModelError("invalidInput")`,
 * never a raw type error. Returns a freshly-built array (never the
 * caller's reference), matching `payload-validation.ts`'s
 * read-once-then-copy discipline.
 */
export function validateHomeLayoutPayload(
  schemaVersion: number,
  payload: unknown,
): readonly HomeLayoutSectionEntry[] {
  if (schemaVersion !== HOME_LAYOUT_SCHEMA_VERSION) {
    throw new ContentModelError(
      "invalidInput",
      "The Home layout payload schema version is not supported.",
    );
  }
  if (!Array.isArray(payload) || payload.length !== HOME_SECTION_KEYS.length) {
    throw new ContentModelError(
      "invalidInput",
      "The Home layout payload must list every registry section exactly once.",
    );
  }
  const seen = new Set<HomeSectionKey>();
  const result: HomeLayoutSectionEntry[] = [];
  for (const candidate of payload) {
    if (typeof candidate !== "object" || candidate === null || Array.isArray(candidate)) {
      throw new ContentModelError("invalidInput", "The Home layout payload shape is invalid.");
    }
    const row = candidate as Record<string, unknown>;
    const keys = Object.keys(row);
    if (keys.length !== 2 || !keys.includes("key") || !keys.includes("enabled")) {
      throw new ContentModelError("invalidInput", "The Home layout payload shape is invalid.");
    }
    const key = row.key;
    const enabled = row.enabled;
    if (!isHomeSectionKey(key)) {
      throw new ContentModelError(
        "invalidInput",
        "The Home layout payload references a section outside the registry.",
      );
    }
    if (typeof enabled !== "boolean") {
      throw new ContentModelError("invalidInput", "The Home layout payload shape is invalid.");
    }
    if (seen.has(key)) {
      throw new ContentModelError(
        "invalidInput",
        "The Home layout payload lists the same section more than once.",
      );
    }
    seen.add(key);
    result.push({ key, enabled });
  }
  if (seen.size !== HOME_SECTION_KEYS.length) {
    throw new ContentModelError(
      "invalidInput",
      "The Home layout payload is missing one or more registry sections.",
    );
  }
  return result;
}

/**
 * Idempotent bootstrap (Story 2.1). Safe to call repeatedly and safe to
 * call concurrently with itself: every step is an upsert/find-or-create,
 * and the `HomeLayout.singleton` unique constraint is the final backstop
 * against a duplicate layout row even under a race.
 *
 * For each of the eleven registry keys, ensures a `ContentEntity`
 * (`contentType = home-section:<key>`), a `HomeSection` registry row, and
 * both canonical `ContentTranslation` rows (tr/en, content-less until Story
 * 2.2's editor saves a draft) all exist. Then ensures exactly one
 * `HomeLayout` row exists; if none does, creates it together with a
 * baseline `HomeLayoutRevision` (`defaultHomeLayoutPayload()`) set as both
 * the draft and published pointer, so the registry starts in a valid,
 * already-published state that mirrors today's live section order/
 * visibility.
 *
 * Never invoked implicitly from a page render - callers are `prisma/seed.ts`
 * for real environments and integration tests directly against
 * `testDatabase.client`.
 */
export async function ensureHomeSectionRegistry(client: PrismaClient): Promise<void> {
  for (const key of HOME_SECTION_KEYS) {
    const existing = await client.homeSection.findUnique({ where: { key } });
    if (existing) continue;

    await client.$transaction(async (tx) => {
      // Re-check inside the transaction: two concurrent bootstrap calls
      // could both pass the check above before either commits.
      const stillMissing = await tx.homeSection.findUnique({ where: { key } });
      if (stillMissing) return;

      const entity = await tx.contentEntity.create({
        data: { contentType: homeSectionContentType(key), provenance: "authored" },
      });
      await tx.homeSection.create({
        data: { key, entityId: entity.id, schemaVersion: 1 },
      });
      await Promise.all(
        (["tr", "en"] as const).map((locale) =>
          tx.contentTranslation.create({ data: { entityId: entity.id, locale } }),
        ),
      );
    });
  }

  const existingLayout = await client.homeLayout.findUnique({ where: { singleton: true } });
  if (existingLayout) return;

  try {
    await client.$transaction(async (tx) => {
      const layout = await tx.homeLayout.create({ data: {} });
      const revision = await tx.homeLayoutRevision.create({
        data: {
          layoutId: layout.id,
          schemaVersion: HOME_LAYOUT_SCHEMA_VERSION,
          payload: defaultHomeLayoutPayload(),
          createdBy: "system:bootstrap",
        },
      });
      await tx.homeLayout.update({
        where: { id: layout.id },
        data: {
          draftRevisionId: revision.id,
          publishedRevisionId: revision.id,
          version: 1,
          publishedAt: new Date(),
        },
      });
    });
  } catch (error) {
    // A concurrent bootstrap call already created the singleton row between
    // the check above and this transaction - the unique `singleton` column
    // rejects the second insert. That is success, not failure: exactly one
    // HomeLayout row exists either way.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return;
    throw error;
  }
}
