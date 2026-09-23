-- Switches every page's share image to its branded card (white KADİK logo on
-- the brand blue, public/kadik/og/*.png). Only pages still on a bundled photo or
-- with no image are changed; an image picked from the media library is kept.

UPDATE "KadikPageContent"
SET "data" = jsonb_set("data", '{seo,image}', '{"url": "/kadik/og/default.png", "assetId": null}'::jsonb), "updatedAt" = CURRENT_TIMESTAMP
WHERE "key" = 'home' AND "data" ? 'seo'
  AND coalesce("data"->'seo'->'image'->>'assetId', '') = ''
  AND (coalesce("data"->'seo'->'image'->>'url', '') = '' OR "data"->'seo'->'image'->>'url' LIKE '/kadik/is-%');
UPDATE "KadikPageContent"
SET "data" = jsonb_set("data", '{seo,image}', '{"url": "/kadik/og/about.png", "assetId": null}'::jsonb), "updatedAt" = CURRENT_TIMESTAMP
WHERE "key" = 'about' AND "data" ? 'seo'
  AND coalesce("data"->'seo'->'image'->>'assetId', '') = ''
  AND (coalesce("data"->'seo'->'image'->>'url', '') = '' OR "data"->'seo'->'image'->>'url' LIKE '/kadik/is-%');
UPDATE "KadikPageContent"
SET "data" = jsonb_set("data", '{seo,image}', '{"url": "/kadik/og/board.png", "assetId": null}'::jsonb), "updatedAt" = CURRENT_TIMESTAMP
WHERE "key" = 'board' AND "data" ? 'seo'
  AND coalesce("data"->'seo'->'image'->>'assetId', '') = ''
  AND (coalesce("data"->'seo'->'image'->>'url', '') = '' OR "data"->'seo'->'image'->>'url' LIKE '/kadik/is-%');
UPDATE "KadikPageContent"
SET "data" = jsonb_set("data", '{seo,image}', '{"url": "/kadik/og/events.png", "assetId": null}'::jsonb), "updatedAt" = CURRENT_TIMESTAMP
WHERE "key" = 'events' AND "data" ? 'seo'
  AND coalesce("data"->'seo'->'image'->>'assetId', '') = ''
  AND (coalesce("data"->'seo'->'image'->>'url', '') = '' OR "data"->'seo'->'image'->>'url' LIKE '/kadik/is-%');
UPDATE "KadikPageContent"
SET "data" = jsonb_set("data", '{seo,image}', '{"url": "/kadik/og/announcements.png", "assetId": null}'::jsonb), "updatedAt" = CURRENT_TIMESTAMP
WHERE "key" = 'announcements' AND "data" ? 'seo'
  AND coalesce("data"->'seo'->'image'->>'assetId', '') = ''
  AND (coalesce("data"->'seo'->'image'->>'url', '') = '' OR "data"->'seo'->'image'->>'url' LIKE '/kadik/is-%');
UPDATE "KadikPageContent"
SET "data" = jsonb_set("data", '{seo,image}', '{"url": "/kadik/og/news.png", "assetId": null}'::jsonb), "updatedAt" = CURRENT_TIMESTAMP
WHERE "key" = 'news' AND "data" ? 'seo'
  AND coalesce("data"->'seo'->'image'->>'assetId', '') = ''
  AND (coalesce("data"->'seo'->'image'->>'url', '') = '' OR "data"->'seo'->'image'->>'url' LIKE '/kadik/is-%');
UPDATE "KadikPageContent"
SET "data" = jsonb_set("data", '{seo,image}', '{"url": "/kadik/og/membership.png", "assetId": null}'::jsonb), "updatedAt" = CURRENT_TIMESTAMP
WHERE "key" = 'membership' AND "data" ? 'seo'
  AND coalesce("data"->'seo'->'image'->>'assetId', '') = ''
  AND (coalesce("data"->'seo'->'image'->>'url', '') = '' OR "data"->'seo'->'image'->>'url' LIKE '/kadik/is-%');
UPDATE "KadikPageContent"
SET "data" = jsonb_set("data", '{seo,image}', '{"url": "/kadik/og/gallery.png", "assetId": null}'::jsonb), "updatedAt" = CURRENT_TIMESTAMP
WHERE "key" = 'gallery' AND "data" ? 'seo'
  AND coalesce("data"->'seo'->'image'->>'assetId', '') = ''
  AND (coalesce("data"->'seo'->'image'->>'url', '') = '' OR "data"->'seo'->'image'->>'url' LIKE '/kadik/is-%');
UPDATE "KadikPageContent"
SET "data" = jsonb_set("data", '{seo,image}', '{"url": "/kadik/og/contact.png", "assetId": null}'::jsonb), "updatedAt" = CURRENT_TIMESTAMP
WHERE "key" = 'contact' AND "data" ? 'seo'
  AND coalesce("data"->'seo'->'image'->>'assetId', '') = ''
  AND (coalesce("data"->'seo'->'image'->>'url', '') = '' OR "data"->'seo'->'image'->>'url' LIKE '/kadik/is-%');
UPDATE "KadikPageContent"
SET "data" = jsonb_set("data", '{seo,image}', '{"url": "/kadik/og/privacy.png", "assetId": null}'::jsonb), "updatedAt" = CURRENT_TIMESTAMP
WHERE "key" = 'privacy' AND "data" ? 'seo'
  AND coalesce("data"->'seo'->'image'->>'assetId', '') = ''
  AND (coalesce("data"->'seo'->'image'->>'url', '') = '' OR "data"->'seo'->'image'->>'url' LIKE '/kadik/is-%');
UPDATE "KadikPageContent"
SET "data" = jsonb_set("data", '{seo,image}', '{"url": "/kadik/og/terms.png", "assetId": null}'::jsonb), "updatedAt" = CURRENT_TIMESTAMP
WHERE "key" = 'terms' AND "data" ? 'seo'
  AND coalesce("data"->'seo'->'image'->>'assetId', '') = ''
  AND (coalesce("data"->'seo'->'image'->>'url', '') = '' OR "data"->'seo'->'image'->>'url' LIKE '/kadik/is-%');
UPDATE "KadikPageContent"
SET "data" = jsonb_set("data", '{seo,image}', '{"url": "/kadik/og/charter.png", "assetId": null}'::jsonb), "updatedAt" = CURRENT_TIMESTAMP
WHERE "key" = 'charter' AND "data" ? 'seo'
  AND coalesce("data"->'seo'->'image'->>'assetId', '') = ''
  AND (coalesce("data"->'seo'->'image'->>'url', '') = '' OR "data"->'seo'->'image'->>'url' LIKE '/kadik/is-%');
UPDATE "KadikPageContent"
SET "data" = jsonb_set("data", '{seo,image}', '{"url": "/kadik/og/not-found.png", "assetId": null}'::jsonb), "updatedAt" = CURRENT_TIMESTAMP
WHERE "key" = 'notFound' AND "data" ? 'seo'
  AND coalesce("data"->'seo'->'image'->>'assetId', '') = ''
  AND (coalesce("data"->'seo'->'image'->>'url', '') = '' OR "data"->'seo'->'image'->>'url' LIKE '/kadik/is-%');
