-- CreateTable
CREATE TABLE "ContentRoute" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "translationId" TEXT NOT NULL,
    "locale" "ContentLocale" NOT NULL,
    "contentType" TEXT NOT NULL,
    "collectionSegment" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentRoute_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ContentRoute_translationId_key" ON "ContentRoute"("translationId");

-- CreateIndex
CREATE INDEX "ContentRoute_entityId_idx" ON "ContentRoute"("entityId");

-- CreateIndex
CREATE UNIQUE INDEX "ContentRoute_contentType_locale_collectionSegment_slug_key" ON "ContentRoute"("contentType", "locale", "collectionSegment", "slug");

-- AddForeignKey
ALTER TABLE "ContentRoute" ADD CONSTRAINT "ContentRoute_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "ContentEntity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentRoute" ADD CONSTRAINT "ContentRoute_translationId_fkey" FOREIGN KEY ("translationId") REFERENCES "ContentTranslation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
