-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('UNREAD', 'READ', 'REPLIED', 'PROCESSED', 'ARCHIVED', 'SPAM');

-- AlterTable: add the new columns first (nullable/defaulted) so existing
-- rows can be backfilled before any NOT NULL/uniqueness constraint is
-- enforced - additive, idempotent-safe migration per NFR-4.
ALTER TABLE "Message"
  ADD COLUMN "status" "MessageStatus" NOT NULL DEFAULT 'UNREAD',
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "submissionHash" TEXT,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Backfill: legacy `read` boolean maps onto the new status enum; every
-- pre-existing row gets a unique placeholder submissionHash (its own
-- random-salted id hash - format-distinct from the real sha256 hex the
-- application computes for new submissions, so it can never collide with
-- one).
UPDATE "Message"
SET
  "status" = CASE WHEN "read" THEN 'READ'::"MessageStatus" ELSE 'UNREAD'::"MessageStatus" END,
  "submissionHash" = md5(random()::text || "id")
WHERE "submissionHash" IS NULL;

-- Enforce NOT NULL + uniqueness now that every row carries a value.
ALTER TABLE "Message" ALTER COLUMN "submissionHash" SET NOT NULL;
CREATE UNIQUE INDEX "Message_submissionHash_key" ON "Message"("submissionHash");

-- Drop the legacy read boolean and its index; status/createdAt replaces it.
DROP INDEX "Message_read_createdAt_idx";
ALTER TABLE "Message" DROP COLUMN "read";
CREATE INDEX "Message_status_createdAt_idx" ON "Message"("status", "createdAt");

-- CreateTable
CREATE TABLE "ContactRateLimit" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "bucketKey" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContactRateLimit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ContactRateLimit_scope_bucketKey_windowStart_key" ON "ContactRateLimit"("scope", "bucketKey", "windowStart");

-- CreateIndex
CREATE INDEX "ContactRateLimit_windowStart_idx" ON "ContactRateLimit"("windowStart");
