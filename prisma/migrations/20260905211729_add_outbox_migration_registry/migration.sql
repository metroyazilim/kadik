-- CreateEnum
CREATE TYPE "OutboxEventStatus" AS ENUM ('PENDING', 'PROCESSED');

-- CreateEnum
CREATE TYPE "MigrationDomainState" AS ENUM ('LEGACY', 'SHADOW', 'COMPARE', 'NEW', 'RETIRED');

-- CreateTable
CREATE TABLE "InvalidationOutboxEvent" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceEntityId" TEXT NOT NULL,
    "sourceTranslationId" TEXT,
    "locale" "ContentLocale",
    "tags" TEXT[],
    "status" "OutboxEventStatus" NOT NULL DEFAULT 'PENDING',
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "InvalidationOutboxEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LegacyMigrationMap" (
    "id" TEXT NOT NULL,
    "migrationVersion" TEXT NOT NULL,
    "sourceTable" TEXT NOT NULL,
    "sourcePrimaryKey" TEXT NOT NULL,
    "sourceLocale" "ContentLocale" NOT NULL,
    "sourceHash" TEXT NOT NULL,
    "targetEntityId" TEXT NOT NULL,
    "targetTranslationId" TEXT NOT NULL,
    "targetRevisionId" TEXT NOT NULL,
    "mappingMethod" TEXT NOT NULL,
    "mappingConfidence" TEXT NOT NULL,
    "approvedBy" TEXT,
    "migratedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LegacyMigrationMap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MigrationDomainRegistry" (
    "id" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "state" "MigrationDomainState" NOT NULL DEFAULT 'LEGACY',
    "version" INTEGER NOT NULL DEFAULT 0,
    "compareResult" JSONB,
    "unresolvedParityFailures" BOOLEAN NOT NULL DEFAULT false,
    "observationOwner" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MigrationDomainRegistry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InvalidationOutboxEvent_status_createdAt_idx" ON "InvalidationOutboxEvent"("status", "createdAt");

-- CreateIndex
CREATE INDEX "InvalidationOutboxEvent_sourceEntityId_idx" ON "InvalidationOutboxEvent"("sourceEntityId");

-- CreateIndex
CREATE UNIQUE INDEX "LegacyMigrationMap_migrationVersion_sourceTable_sourcePrima_key" ON "LegacyMigrationMap"("migrationVersion", "sourceTable", "sourcePrimaryKey");

-- CreateIndex
CREATE UNIQUE INDEX "MigrationDomainRegistry_domain_key" ON "MigrationDomainRegistry"("domain");
