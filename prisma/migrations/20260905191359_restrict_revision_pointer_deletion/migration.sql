-- DropForeignKey
ALTER TABLE "ContentTranslation" DROP CONSTRAINT "ContentTranslation_draftRevisionId_fkey";

-- DropForeignKey
ALTER TABLE "ContentTranslation" DROP CONSTRAINT "ContentTranslation_publishedRevisionId_fkey";

-- AddForeignKey
ALTER TABLE "ContentTranslation" ADD CONSTRAINT "ContentTranslation_draftRevisionId_fkey" FOREIGN KEY ("draftRevisionId") REFERENCES "ContentTranslationRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentTranslation" ADD CONSTRAINT "ContentTranslation_publishedRevisionId_fkey" FOREIGN KEY ("publishedRevisionId") REFERENCES "ContentTranslationRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
