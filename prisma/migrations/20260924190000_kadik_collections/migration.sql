-- KADİK etkinlik, duyuru ve galeri koleksiyonları. Mevcut sayfa içeriğindeki
-- (KadikPageContent) listeler yeni tablolara taşınır; sayfa hiç kaydedilmemişse
-- sitenin ilk içeriği eklenir.

CREATE TABLE "KadikEvent" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "startTime" TEXT,
    "endTime" TEXT,
    "location" TEXT,
    "description" TEXT,
    "imageAssetId" TEXT,
    "imageUrl" TEXT,
    "registrationUrl" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "KadikEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "KadikEvent_date_idx" ON "KadikEvent"("date");

CREATE TABLE "KadikAnnouncement" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "date" TEXT,
    "linkUrl" TEXT,
    "linkLabel" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "KadikAnnouncement_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "KadikAnnouncement_order_idx" ON "KadikAnnouncement"("order");

CREATE TABLE "KadikGalleryItem" (
    "id" TEXT NOT NULL,
    "imageAssetId" TEXT,
    "imageUrl" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT '',
    "caption" TEXT NOT NULL DEFAULT '',
    "order" INTEGER NOT NULL DEFAULT 0,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "KadikGalleryItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "KadikGalleryItem_order_idx" ON "KadikGalleryItem"("order");

-- Etkinlikler: kaydedilmiş sayfa içeriğinden
INSERT INTO "KadikEvent" ("id", "title", "date", "location", "updatedAt")
SELECT 'kev_' || substr(md5((e.value->>'date') || (e.value->>'title') || e.ordinality::text), 1, 20), e.value->>'title', e.value->>'date', NULL, CURRENT_TIMESTAMP
FROM "KadikPageContent" p, jsonb_array_elements(p."data"->'events'->'events') WITH ORDINALITY e
WHERE p."key" = 'events' AND coalesce(e.value->>'title', '') <> '' AND coalesce(e.value->>'date', '') ~ '^\d{4}-\d{2}-\d{2}$';

-- Etkinlikler: sayfa hiç kaydedilmemişse sitenin ilk içeriği
INSERT INTO "KadikEvent" ("id", "title", "date", "updatedAt")
SELECT v.* FROM (VALUES
  ('kev_default_1', 'Sector boards joint meeting', '2026-09-08', CURRENT_TIMESTAMP),
  ('kev_default_2', 'Export and foreign markets panel', '2026-09-15', CURRENT_TIMESTAMP),
  ('kev_default_3', 'Member companies networking meet-up', '2026-09-17', CURRENT_TIMESTAMP),
  ('kev_default_4', 'Access to finance workshop', '2026-09-29', CURRENT_TIMESTAMP)
) AS v(id, title, date, "updatedAt")
WHERE NOT EXISTS (SELECT 1 FROM "KadikPageContent" WHERE "key" = 'events');

-- Duyurular: kaydedilmiş sayfa içeriğinden (ortak kart metni her duyuruya yazılır)
INSERT INTO "KadikAnnouncement" ("id", "title", "text", "order", "updatedAt")
SELECT 'kan_' || substr(md5((i.value #>> '{}') || i.ordinality::text), 1, 20), i.value #>> '{}', coalesce(p."data"->'announcements'->>'itemText', ''), i.ordinality::int - 1, CURRENT_TIMESTAMP
FROM "KadikPageContent" p, jsonb_array_elements(p."data"->'announcements'->'items') WITH ORDINALITY i
WHERE p."key" = 'announcements' AND coalesce(i.value #>> '{}', '') <> '';

INSERT INTO "KadikAnnouncement" ("id", "title", "text", "order", "updatedAt")
SELECT v.* FROM (VALUES
  ('kan_default_1', 'Sector Boards', 'Current topics covering the business world''s agenda, our members'' development and new connections.', 0, CURRENT_TIMESTAMP),
  ('kan_default_2', 'Membership Announcements', 'Current topics covering the business world''s agenda, our members'' development and new connections.', 1, CURRENT_TIMESTAMP),
  ('kan_default_3', 'International Business Opportunities', 'Current topics covering the business world''s agenda, our members'' development and new connections.', 2, CURRENT_TIMESTAMP),
  ('kan_default_4', 'Training and Development', 'Current topics covering the business world''s agenda, our members'' development and new connections.', 3, CURRENT_TIMESTAMP),
  ('kan_default_5', 'Trade Delegations', 'Current topics covering the business world''s agenda, our members'' development and new connections.', 4, CURRENT_TIMESTAMP),
  ('kan_default_6', 'Council Gatherings', 'Current topics covering the business world''s agenda, our members'' development and new connections.', 5, CURRENT_TIMESTAMP),
  ('kan_default_7', 'Publications', 'Current topics covering the business world''s agenda, our members'' development and new connections.', 6, CURRENT_TIMESTAMP),
  ('kan_default_8', 'Partnerships', 'Current topics covering the business world''s agenda, our members'' development and new connections.', 7, CURRENT_TIMESTAMP)
) AS v(id, title, text, "order", "updatedAt")
WHERE NOT EXISTS (SELECT 1 FROM "KadikPageContent" WHERE "key" = 'announcements');

-- Galeri: kaydedilmiş sayfa içeriğinden
INSERT INTO "KadikGalleryItem" ("id", "imageAssetId", "imageUrl", "category", "caption", "order", "updatedAt")
SELECT 'kga_' || substr(md5(coalesce(g.value->'image'->>'url', '') || g.ordinality::text), 1, 20),
       nullif(g.value->'image'->>'assetId', ''), g.value->'image'->>'url', coalesce(g.value->>'category', ''), coalesce(g.value->>'alt', ''), g.ordinality::int - 1, CURRENT_TIMESTAMP
FROM "KadikPageContent" p, jsonb_array_elements(p."data"->'gallery'->'items') WITH ORDINALITY g
WHERE p."key" = 'gallery' AND coalesce(g.value->'image'->>'url', '') <> '';

INSERT INTO "KadikGalleryItem" ("id", "imageUrl", "category", "caption", "order", "updatedAt")
SELECT v.* FROM (VALUES
  ('kga_default_1', '/kadik/is-galeri-1.webp', 'Events', 'KADIK events 1', 0, CURRENT_TIMESTAMP),
  ('kga_default_2', '/kadik/is-galeri-2.webp', 'Meetings', 'KADIK meetings 2', 1, CURRENT_TIMESTAMP),
  ('kga_default_3', '/kadik/is-galeri-3.webp', 'Business Trips', 'KADIK business trips 3', 2, CURRENT_TIMESTAMP),
  ('kga_default_4', '/kadik/is-galeri-4.webp', 'Events', 'KADIK events 4', 3, CURRENT_TIMESTAMP),
  ('kga_default_5', '/kadik/is-galeri-5.webp', 'Meetings', 'KADIK meetings 5', 4, CURRENT_TIMESTAMP),
  ('kga_default_6', '/kadik/is-galeri-6.webp', 'Business Trips', 'KADIK business trips 6', 5, CURRENT_TIMESTAMP),
  ('kga_default_7', '/kadik/is-galeri-7.webp', 'Events', 'KADIK events 7', 6, CURRENT_TIMESTAMP),
  ('kga_default_8', '/kadik/is-galeri-8.webp', 'Meetings', 'KADIK meetings 8', 7, CURRENT_TIMESTAMP),
  ('kga_default_9', '/kadik/is-galeri-9.webp', 'Business Trips', 'KADIK business trips 9', 8, CURRENT_TIMESTAMP)
) AS v(id, "imageUrl", category, caption, "order", "updatedAt")
WHERE NOT EXISTS (SELECT 1 FROM "KadikPageContent" WHERE "key" = 'gallery');

-- Galeri görsellerinin medya kütüphanesi kullanım kayıtları yeni tabloya taşınır.
UPDATE "MediaUsage" SET "surface" = 'kadik-gallery', "field" = 'gallery'
WHERE "surface" = 'kadik-page' AND "field" LIKE 'gallery:gallery.items.%';
