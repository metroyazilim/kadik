-- KADİK public sayfa içerikleri: her sayfa için tek satır, JSON içerik.
-- CreateTable
CREATE TABLE "KadikPageContent" (
    "key" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KadikPageContent_pkey" PRIMARY KEY ("key")
);
