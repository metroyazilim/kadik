-- CreateTable
CREATE TABLE "SiteSettingsRegistry" (
    "id" TEXT NOT NULL,
    "singleton" BOOLEAN NOT NULL DEFAULT true,
    "entityId" TEXT NOT NULL,
    "schemaVersion" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteSettingsRegistry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SiteSettingsRegistry_singleton_key" ON "SiteSettingsRegistry"("singleton");

-- CreateIndex
CREATE UNIQUE INDEX "SiteSettingsRegistry_entityId_key" ON "SiteSettingsRegistry"("entityId");

-- AddForeignKey
ALTER TABLE "SiteSettingsRegistry" ADD CONSTRAINT "SiteSettingsRegistry_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "ContentEntity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
