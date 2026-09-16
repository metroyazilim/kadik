-- CreateEnum
CREATE TYPE "MediaStorageStatus" AS ENUM ('ACTIVE', 'MISSING');

-- CreateTable
CREATE TABLE "MediaAsset" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "extension" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "checksum" TEXT NOT NULL,
    "altText" TEXT,
    "caption" TEXT,
    "archivedAt" TIMESTAMP(3),
    "storageStatus" "MediaStorageStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaUsage" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "entityId" TEXT,
    "surface" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "locale" "ContentLocale",
    "altText" TEXT,
    "caption" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MediaUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaUploadAttempt" (
    "id" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "MediaUploadAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MediaAsset_objectKey_key" ON "MediaAsset"("objectKey");

-- CreateIndex
CREATE INDEX "MediaAsset_mimeType_idx" ON "MediaAsset"("mimeType");

-- CreateIndex
CREATE INDEX "MediaAsset_archivedAt_createdAt_idx" ON "MediaAsset"("archivedAt", "createdAt");

-- CreateIndex
CREATE INDEX "MediaAsset_checksum_idx" ON "MediaAsset"("checksum");

-- CreateIndex
CREATE INDEX "MediaAsset_storageStatus_idx" ON "MediaAsset"("storageStatus");

-- CreateIndex
CREATE INDEX "MediaUsage_assetId_idx" ON "MediaUsage"("assetId");

-- CreateIndex
CREATE INDEX "MediaUsage_entityId_idx" ON "MediaUsage"("entityId");

-- CreateIndex
CREATE INDEX "MediaUsage_surface_field_idx" ON "MediaUsage"("surface", "field");

-- CreateIndex
CREATE UNIQUE INDEX "MediaUploadAttempt_objectKey_key" ON "MediaUploadAttempt"("objectKey");

-- CreateIndex
CREATE INDEX "MediaUploadAttempt_resolvedAt_createdAt_idx" ON "MediaUploadAttempt"("resolvedAt", "createdAt");

-- AddForeignKey
ALTER TABLE "MediaUsage" ADD CONSTRAINT "MediaUsage_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "MediaAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaUsage" ADD CONSTRAINT "MediaUsage_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "ContentEntity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
