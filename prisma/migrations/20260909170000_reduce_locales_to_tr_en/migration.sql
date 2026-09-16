-- Product locale cutover: Turkish remains the prefixless source locale and
-- English remains the single Global locale. Russian and Arabic localized
-- content is intentionally removed; Turkish and English rows are untouched.
DELETE FROM "InvalidationOutboxEvent"
WHERE "locale"::text IN ('ru', 'ar');

DELETE FROM "MediaUsage"
WHERE "locale"::text IN ('ru', 'ar');

DELETE FROM "ContentRoute"
WHERE "locale"::text IN ('ru', 'ar');

DELETE FROM "LegacyMigrationMap"
WHERE "sourceLocale"::text IN ('ru', 'ar');

UPDATE "ContentTranslation"
SET "draftRevisionId" = NULL,
    "publishedRevisionId" = NULL
WHERE "locale"::text IN ('ru', 'ar');

DELETE FROM "ContentTranslation"
WHERE "locale"::text IN ('ru', 'ar');

DROP TABLE "SiteContentRu";
DROP TABLE "SiteContentAr";

ALTER TYPE "ContentLocale" RENAME TO "ContentLocale_old";
CREATE TYPE "ContentLocale" AS ENUM ('tr', 'en');

ALTER TABLE "ContentTranslation"
  ALTER COLUMN "locale" TYPE "ContentLocale"
  USING ("locale"::text::"ContentLocale");

ALTER TABLE "ContentRoute"
  ALTER COLUMN "locale" TYPE "ContentLocale"
  USING ("locale"::text::"ContentLocale");

ALTER TABLE "InvalidationOutboxEvent"
  ALTER COLUMN "locale" TYPE "ContentLocale"
  USING ("locale"::text::"ContentLocale");

ALTER TABLE "LegacyMigrationMap"
  ALTER COLUMN "sourceLocale" TYPE "ContentLocale"
  USING ("sourceLocale"::text::"ContentLocale");

ALTER TABLE "MediaUsage"
  ALTER COLUMN "locale" TYPE "ContentLocale"
  USING ("locale"::text::"ContentLocale");

DROP TYPE "ContentLocale_old";
