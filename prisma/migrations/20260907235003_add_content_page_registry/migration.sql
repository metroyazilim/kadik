-- CreateEnum
CREATE TYPE "ContentPageKey" AS ENUM ('about');

-- AlterTable
ALTER TABLE "Message" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "ContentPageRegistry" (
    "id" TEXT NOT NULL,
    "key" "ContentPageKey" NOT NULL,
    "entityId" TEXT NOT NULL,
    "schemaVersion" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentPageRegistry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ContentPageRegistry_key_key" ON "ContentPageRegistry"("key");

-- CreateIndex
CREATE UNIQUE INDEX "ContentPageRegistry_entityId_key" ON "ContentPageRegistry"("entityId");

-- AddForeignKey
ALTER TABLE "ContentPageRegistry" ADD CONSTRAINT "ContentPageRegistry_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "ContentEntity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
