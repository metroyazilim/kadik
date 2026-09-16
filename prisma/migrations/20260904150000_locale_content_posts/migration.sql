-- Legacy locale content tables retained only for migration compatibility.
CREATE TABLE "SiteContentTr" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SiteContentTr_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "SiteContentEn" (LIKE "SiteContentTr" INCLUDING DEFAULTS INCLUDING CONSTRAINTS);
CREATE TABLE "SiteContentRu" (LIKE "SiteContentTr" INCLUDING DEFAULTS INCLUDING CONSTRAINTS);
CREATE TABLE "SiteContentAr" (LIKE "SiteContentTr" INCLUDING DEFAULTS INCLUDING CONSTRAINTS);
CREATE UNIQUE INDEX "SiteContentTr_key_key" ON "SiteContentTr"("key");
CREATE UNIQUE INDEX "SiteContentEn_key_key" ON "SiteContentEn"("key");
CREATE UNIQUE INDEX "SiteContentRu_key_key" ON "SiteContentRu"("key");
CREATE UNIQUE INDEX "SiteContentAr_key_key" ON "SiteContentAr"("key");

-- Preserve the already-seeded dictionary before removing the old locale-key table.
INSERT INTO "SiteContentTr" ("id", "key", "value", "published", "createdAt", "updatedAt")
SELECT md5('site-content:tr:' || "key"), "key", "value", "published", "createdAt", "updatedAt" FROM "SiteContent" WHERE "locale" = 'tr';
INSERT INTO "SiteContentEn" ("id", "key", "value", "published", "createdAt", "updatedAt")
SELECT md5('site-content:en:' || "key"), "key", "value", "published", "createdAt", "updatedAt" FROM "SiteContent" WHERE "locale" = 'en';
INSERT INTO "SiteContentRu" ("id", "key", "value", "published", "createdAt", "updatedAt")
SELECT md5('site-content:ru:' || "key"), "key", "value", "published", "createdAt", "updatedAt" FROM "SiteContent" WHERE "locale" = 'ru';
INSERT INTO "SiteContentAr" ("id", "key", "value", "published", "createdAt", "updatedAt")
SELECT md5('site-content:ar:' || "key"), "key", "value", "published", "createdAt", "updatedAt" FROM "SiteContent" WHERE "locale" = 'ar';
DROP TABLE "SiteContent";

CREATE TABLE "PostTr" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "excerpt" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "image" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PostTr_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "PostEn" (LIKE "PostTr" INCLUDING DEFAULTS INCLUDING CONSTRAINTS);
CREATE TABLE "PostRu" (LIKE "PostTr" INCLUDING DEFAULTS INCLUDING CONSTRAINTS);
CREATE TABLE "PostAr" (LIKE "PostTr" INCLUDING DEFAULTS INCLUDING CONSTRAINTS);
CREATE UNIQUE INDEX "PostTr_slug_key" ON "PostTr"("slug");
CREATE UNIQUE INDEX "PostEn_slug_key" ON "PostEn"("slug");
CREATE UNIQUE INDEX "PostRu_slug_key" ON "PostRu"("slug");
CREATE UNIQUE INDEX "PostAr_slug_key" ON "PostAr"("slug");
CREATE INDEX "PostTr_published_publishedAt_idx" ON "PostTr"("published", "publishedAt");
CREATE INDEX "PostEn_published_publishedAt_idx" ON "PostEn"("published", "publishedAt");
CREATE INDEX "PostRu_published_publishedAt_idx" ON "PostRu"("published", "publishedAt");
CREATE INDEX "PostAr_published_publishedAt_idx" ON "PostAr"("published", "publishedAt");
