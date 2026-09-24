-- Etkinlik yalnız ad, tarih, saat, yer ve açıklamadan oluşur: görsel ve kayıt
-- bağlantısı alanları kaldırılır.
DELETE FROM "MediaUsage" WHERE "surface" = 'kadik-event';
ALTER TABLE "KadikEvent" DROP COLUMN "imageAssetId", DROP COLUMN "imageUrl", DROP COLUMN "registrationUrl";
