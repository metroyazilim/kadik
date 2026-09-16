-- Şema ile migration zinciri arasındaki sürüklenmeyi kapatır: `ReusableSection`,
-- `PageLayout`, `PageLayoutRevision` ve `PageSection` tabloları
-- `prisma/schema.prisma` içinde tanımlıydı ama hiçbir migration onları
-- oluşturmuyordu; temiz bir veritabanı bu yüzden içerik anlık görüntüsünü
-- import edemiyordu. Yalnız eklemeli: eski dil bazlı tablolar (FaqTr, PostEn,
-- ...) mevcut kurulumlarda olduğu gibi bırakılır, silinmez.

-- CreateTable
CREATE TABLE "ReusableSection" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReusableSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PageLayout" (
    "id" TEXT NOT NULL,
    "pageKey" "ContentPageKey" NOT NULL,
    "draftRevisionId" TEXT,
    "publishedRevisionId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PageLayout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PageLayoutRevision" (
    "id" TEXT NOT NULL,
    "layoutId" TEXT NOT NULL,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "payload" JSONB NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PageLayoutRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PageSection" (
    "id" TEXT NOT NULL,
    "layoutId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PageSection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReusableSection_slug_key" ON "ReusableSection"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "ReusableSection_entityId_key" ON "ReusableSection"("entityId");

-- CreateIndex
CREATE UNIQUE INDEX "PageLayout_pageKey_key" ON "PageLayout"("pageKey");

-- CreateIndex
CREATE INDEX "PageLayout_draftRevisionId_idx" ON "PageLayout"("draftRevisionId");

-- CreateIndex
CREATE INDEX "PageLayout_publishedRevisionId_idx" ON "PageLayout"("publishedRevisionId");

-- CreateIndex
CREATE INDEX "PageLayoutRevision_layoutId_idx" ON "PageLayoutRevision"("layoutId");

-- CreateIndex
CREATE INDEX "PageSection_layoutId_order_idx" ON "PageSection"("layoutId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "PageSection_layoutId_sectionId_key" ON "PageSection"("layoutId", "sectionId");

-- AddForeignKey
ALTER TABLE "ReusableSection" ADD CONSTRAINT "ReusableSection_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "ContentEntity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PageLayout" ADD CONSTRAINT "PageLayout_draftRevisionId_fkey" FOREIGN KEY ("draftRevisionId") REFERENCES "PageLayoutRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PageLayout" ADD CONSTRAINT "PageLayout_publishedRevisionId_fkey" FOREIGN KEY ("publishedRevisionId") REFERENCES "PageLayoutRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PageLayoutRevision" ADD CONSTRAINT "PageLayoutRevision_layoutId_fkey" FOREIGN KEY ("layoutId") REFERENCES "PageLayout"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PageSection" ADD CONSTRAINT "PageSection_layoutId_fkey" FOREIGN KEY ("layoutId") REFERENCES "PageLayout"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PageSection" ADD CONSTRAINT "PageSection_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "ReusableSection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

