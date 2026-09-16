-- Additive RBAC/profile columns already present in the local development
-- database. New and isolated databases need the same schema through the
-- canonical migration chain.
CREATE TYPE "AdminRole" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'AUTHOR');

ALTER TABLE "AdminUser"
  ADD COLUMN "avatarAssetId" TEXT,
  ADD COLUMN "role" "AdminRole" NOT NULL DEFAULT 'ADMIN';
