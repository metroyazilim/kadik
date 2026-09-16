-- CreateEnum
CREATE TYPE "HomeSectionKey" AS ENUM ('hero', 'about', 'brandTrust', 'services', 'process', 'achievements', 'projects', 'marquee', 'team', 'testimonials', 'blog');

-- CreateTable
CREATE TABLE "HomeSection" (
    "id" TEXT NOT NULL,
    "key" "HomeSectionKey" NOT NULL,
    "entityId" TEXT NOT NULL,
    "schemaVersion" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HomeSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HomeLayout" (
    "id" TEXT NOT NULL,
    "singleton" BOOLEAN NOT NULL DEFAULT true,
    "draftRevisionId" TEXT,
    "publishedRevisionId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HomeLayout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HomeLayoutRevision" (
    "id" TEXT NOT NULL,
    "layoutId" TEXT NOT NULL,
    "schemaVersion" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HomeLayoutRevision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HomeSection_key_key" ON "HomeSection"("key");

-- CreateIndex
CREATE UNIQUE INDEX "HomeSection_entityId_key" ON "HomeSection"("entityId");

-- CreateIndex
CREATE UNIQUE INDEX "HomeLayout_singleton_key" ON "HomeLayout"("singleton");

-- CreateIndex
CREATE INDEX "HomeLayout_draftRevisionId_idx" ON "HomeLayout"("draftRevisionId");

-- CreateIndex
CREATE INDEX "HomeLayout_publishedRevisionId_idx" ON "HomeLayout"("publishedRevisionId");

-- CreateIndex
CREATE INDEX "HomeLayoutRevision_layoutId_idx" ON "HomeLayoutRevision"("layoutId");

-- AddForeignKey
ALTER TABLE "HomeSection" ADD CONSTRAINT "HomeSection_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "ContentEntity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeLayout" ADD CONSTRAINT "HomeLayout_draftRevisionId_fkey" FOREIGN KEY ("draftRevisionId") REFERENCES "HomeLayoutRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeLayout" ADD CONSTRAINT "HomeLayout_publishedRevisionId_fkey" FOREIGN KEY ("publishedRevisionId") REFERENCES "HomeLayoutRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeLayoutRevision" ADD CONSTRAINT "HomeLayoutRevision_layoutId_fkey" FOREIGN KEY ("layoutId") REFERENCES "HomeLayout"("id") ON DELETE CASCADE ON UPDATE CASCADE;
