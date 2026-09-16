-- Additive: ContentEntity gains an explicit, admin-orderable position.
-- Default 0 for every existing row; nothing reorders itself automatically.
ALTER TABLE "ContentEntity" ADD COLUMN "order" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX "ContentEntity_contentType_order_idx" ON "ContentEntity"("contentType", "order");
