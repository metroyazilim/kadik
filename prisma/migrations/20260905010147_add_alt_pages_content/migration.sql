-- AlterTable
ALTER TABLE "PostAr" ALTER COLUMN "updatedAt" DROP DEFAULT,
ADD CONSTRAINT "PostAr_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "PostEn" ALTER COLUMN "updatedAt" DROP DEFAULT,
ADD CONSTRAINT "PostEn_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "PostRu" ALTER COLUMN "updatedAt" DROP DEFAULT,
ADD CONSTRAINT "PostRu_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "PostTr" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "SiteContentAr" ALTER COLUMN "updatedAt" DROP DEFAULT,
ADD CONSTRAINT "SiteContentAr_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "SiteContentEn" ALTER COLUMN "updatedAt" DROP DEFAULT,
ADD CONSTRAINT "SiteContentEn_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "SiteContentRu" ALTER COLUMN "updatedAt" DROP DEFAULT,
ADD CONSTRAINT "SiteContentRu_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "SiteContentTr" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "ServiceTr" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "icon" TEXT,
    "image" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceTr_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceEn" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "icon" TEXT,
    "image" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceEn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceRu" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "icon" TEXT,
    "image" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceRu_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceAr" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "icon" TEXT,
    "image" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceAr_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductTr" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "shortDescription" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "image" TEXT,
    "gallery" JSONB,
    "badge" TEXT,
    "priceLabel" TEXT,
    "ctaUrl" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductTr_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductEn" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "shortDescription" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "image" TEXT,
    "gallery" JSONB,
    "badge" TEXT,
    "priceLabel" TEXT,
    "ctaUrl" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductEn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductRu" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "shortDescription" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "image" TEXT,
    "gallery" JSONB,
    "badge" TEXT,
    "priceLabel" TEXT,
    "ctaUrl" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductRu_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductAr" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "shortDescription" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "image" TEXT,
    "gallery" JSONB,
    "badge" TEXT,
    "priceLabel" TEXT,
    "ctaUrl" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductAr_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectTr" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "coverImage" TEXT,
    "gallery" JSONB,
    "challenge" TEXT NOT NULL,
    "solution" TEXT NOT NULL,
    "client" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectTr_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectEn" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "coverImage" TEXT,
    "gallery" JSONB,
    "challenge" TEXT NOT NULL,
    "solution" TEXT NOT NULL,
    "client" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectEn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectRu" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "coverImage" TEXT,
    "gallery" JSONB,
    "challenge" TEXT NOT NULL,
    "solution" TEXT NOT NULL,
    "client" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectRu_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectAr" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "coverImage" TEXT,
    "gallery" JSONB,
    "challenge" TEXT NOT NULL,
    "solution" TEXT NOT NULL,
    "client" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectAr_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamMemberTr" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "image" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "social" JSONB,
    "bio" TEXT NOT NULL,
    "skills" JSONB,
    "education" JSONB,
    "order" INTEGER NOT NULL DEFAULT 0,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamMemberTr_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamMemberEn" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "image" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "social" JSONB,
    "bio" TEXT NOT NULL,
    "skills" JSONB,
    "education" JSONB,
    "order" INTEGER NOT NULL DEFAULT 0,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamMemberEn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamMemberRu" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "image" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "social" JSONB,
    "bio" TEXT NOT NULL,
    "skills" JSONB,
    "education" JSONB,
    "order" INTEGER NOT NULL DEFAULT 0,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamMemberRu_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamMemberAr" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "image" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "social" JSONB,
    "bio" TEXT NOT NULL,
    "skills" JSONB,
    "education" JSONB,
    "order" INTEGER NOT NULL DEFAULT 0,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamMemberAr_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FaqTr" (
    "id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FaqTr_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FaqEn" (
    "id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FaqEn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FaqRu" (
    "id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FaqRu_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FaqAr" (
    "id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FaqAr_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "subject" TEXT,
    "message" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ServiceTr_slug_key" ON "ServiceTr"("slug");

-- CreateIndex
CREATE INDEX "ServiceTr_published_order_idx" ON "ServiceTr"("published", "order");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceEn_slug_key" ON "ServiceEn"("slug");

-- CreateIndex
CREATE INDEX "ServiceEn_published_order_idx" ON "ServiceEn"("published", "order");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceRu_slug_key" ON "ServiceRu"("slug");

-- CreateIndex
CREATE INDEX "ServiceRu_published_order_idx" ON "ServiceRu"("published", "order");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceAr_slug_key" ON "ServiceAr"("slug");

-- CreateIndex
CREATE INDEX "ServiceAr_published_order_idx" ON "ServiceAr"("published", "order");

-- CreateIndex
CREATE UNIQUE INDEX "ProductTr_slug_key" ON "ProductTr"("slug");

-- CreateIndex
CREATE INDEX "ProductTr_published_order_idx" ON "ProductTr"("published", "order");

-- CreateIndex
CREATE UNIQUE INDEX "ProductEn_slug_key" ON "ProductEn"("slug");

-- CreateIndex
CREATE INDEX "ProductEn_published_order_idx" ON "ProductEn"("published", "order");

-- CreateIndex
CREATE UNIQUE INDEX "ProductRu_slug_key" ON "ProductRu"("slug");

-- CreateIndex
CREATE INDEX "ProductRu_published_order_idx" ON "ProductRu"("published", "order");

-- CreateIndex
CREATE UNIQUE INDEX "ProductAr_slug_key" ON "ProductAr"("slug");

-- CreateIndex
CREATE INDEX "ProductAr_published_order_idx" ON "ProductAr"("published", "order");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectTr_slug_key" ON "ProjectTr"("slug");

-- CreateIndex
CREATE INDEX "ProjectTr_published_order_idx" ON "ProjectTr"("published", "order");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectEn_slug_key" ON "ProjectEn"("slug");

-- CreateIndex
CREATE INDEX "ProjectEn_published_order_idx" ON "ProjectEn"("published", "order");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectRu_slug_key" ON "ProjectRu"("slug");

-- CreateIndex
CREATE INDEX "ProjectRu_published_order_idx" ON "ProjectRu"("published", "order");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectAr_slug_key" ON "ProjectAr"("slug");

-- CreateIndex
CREATE INDEX "ProjectAr_published_order_idx" ON "ProjectAr"("published", "order");

-- CreateIndex
CREATE UNIQUE INDEX "TeamMemberTr_slug_key" ON "TeamMemberTr"("slug");

-- CreateIndex
CREATE INDEX "TeamMemberTr_published_order_idx" ON "TeamMemberTr"("published", "order");

-- CreateIndex
CREATE UNIQUE INDEX "TeamMemberEn_slug_key" ON "TeamMemberEn"("slug");

-- CreateIndex
CREATE INDEX "TeamMemberEn_published_order_idx" ON "TeamMemberEn"("published", "order");

-- CreateIndex
CREATE UNIQUE INDEX "TeamMemberRu_slug_key" ON "TeamMemberRu"("slug");

-- CreateIndex
CREATE INDEX "TeamMemberRu_published_order_idx" ON "TeamMemberRu"("published", "order");

-- CreateIndex
CREATE UNIQUE INDEX "TeamMemberAr_slug_key" ON "TeamMemberAr"("slug");

-- CreateIndex
CREATE INDEX "TeamMemberAr_published_order_idx" ON "TeamMemberAr"("published", "order");

-- CreateIndex
CREATE INDEX "FaqTr_published_order_idx" ON "FaqTr"("published", "order");

-- CreateIndex
CREATE INDEX "FaqEn_published_order_idx" ON "FaqEn"("published", "order");

-- CreateIndex
CREATE INDEX "FaqRu_published_order_idx" ON "FaqRu"("published", "order");

-- CreateIndex
CREATE INDEX "FaqAr_published_order_idx" ON "FaqAr"("published", "order");

-- CreateIndex
CREATE INDEX "Message_read_createdAt_idx" ON "Message"("read", "createdAt");
