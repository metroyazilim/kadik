-- `ContentPageKey` gained the remaining public page keys in the schema but
-- never in a migration, so a freshly migrated database could not hold the
-- `ContentPageRegistry` rows the local database already has. Additive only.
ALTER TYPE "ContentPageKey" ADD VALUE IF NOT EXISTS 'home';
ALTER TYPE "ContentPageKey" ADD VALUE IF NOT EXISTS 'services';
ALTER TYPE "ContentPageKey" ADD VALUE IF NOT EXISTS 'products';
ALTER TYPE "ContentPageKey" ADD VALUE IF NOT EXISTS 'projects';
ALTER TYPE "ContentPageKey" ADD VALUE IF NOT EXISTS 'blog';
ALTER TYPE "ContentPageKey" ADD VALUE IF NOT EXISTS 'faq';
ALTER TYPE "ContentPageKey" ADD VALUE IF NOT EXISTS 'contact';
