-- CreateEnum
CREATE TYPE "ContentLocale" AS ENUM ('tr', 'en', 'ru', 'ar');

-- CreateTable
CREATE TABLE "ContentEntity" (
    "id" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 0,
    "provenance" TEXT NOT NULL DEFAULT 'authored',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentEntity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentTranslation" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "locale" "ContentLocale" NOT NULL,
    "draftRevisionId" TEXT,
    "publishedRevisionId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentTranslationRevision" (
    "id" TEXT NOT NULL,
    "translationId" TEXT NOT NULL,
    "schemaVersion" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,

    CONSTRAINT "ContentTranslationRevision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContentEntity_contentType_idx" ON "ContentEntity"("contentType");

-- CreateIndex
CREATE INDEX "ContentTranslation_draftRevisionId_idx" ON "ContentTranslation"("draftRevisionId");

-- CreateIndex
CREATE INDEX "ContentTranslation_publishedRevisionId_idx" ON "ContentTranslation"("publishedRevisionId");

-- CreateIndex
CREATE UNIQUE INDEX "ContentTranslation_entityId_locale_key" ON "ContentTranslation"("entityId", "locale");

-- CreateIndex
CREATE INDEX "ContentTranslationRevision_translationId_idx" ON "ContentTranslationRevision"("translationId");

-- AddForeignKey
ALTER TABLE "ContentTranslation" ADD CONSTRAINT "ContentTranslation_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "ContentEntity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentTranslation" ADD CONSTRAINT "ContentTranslation_draftRevisionId_fkey" FOREIGN KEY ("draftRevisionId") REFERENCES "ContentTranslationRevision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentTranslation" ADD CONSTRAINT "ContentTranslation_publishedRevisionId_fkey" FOREIGN KEY ("publishedRevisionId") REFERENCES "ContentTranslationRevision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentTranslationRevision" ADD CONSTRAINT "ContentTranslationRevision_translationId_fkey" FOREIGN KEY ("translationId") REFERENCES "ContentTranslation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
