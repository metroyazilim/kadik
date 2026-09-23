-- Fills the SEO title, description and share image of every KADİK page with the
-- recommended copy. A page whose SEO was already customised in the admin panel keeps
-- its title/description and only gains the share image. News articles without SEO
-- fields get recommended ones on their current revision.

UPDATE "KadikPageContent" SET "data" = jsonb_set("data", '{seo}', '{"title": "KADİK London | Kybele Atasever World Business Council", "description": "KADİK is a London-based world business council connecting entrepreneurs, executives and sectors through trust, shared judgement and global partnerships.", "image": {"url": "/kadik/is-hero.webp", "assetId": null}}'::jsonb), "updatedAt" = CURRENT_TIMESTAMP
WHERE "key" = 'home' AND coalesce("data"->'seo'->>'title', '') IN ('KADİK London | Kybele Atasever World Business Council', '') AND coalesce("data"->'seo'->>'description', '') IN ('Kybele Atasever World Business Council brings business people, sectors and international opportunities together through shared judgement.', '');
UPDATE "KadikPageContent" SET "data" = jsonb_set("data", '{seo,image}', '{"url": "/kadik/is-hero.webp", "assetId": null}'::jsonb), "updatedAt" = CURRENT_TIMESTAMP
WHERE "key" = 'home' AND "data" ? 'seo' AND NOT ("data"->'seo' ? 'image');
UPDATE "KadikPageContent" SET "data" = jsonb_set("data", '{seo}', '{"title": "About KADİK | Kybele Atasever World Business Council", "description": "Learn how the Kybele Atasever World Business Council brings entrepreneurs and industry leaders together to grow trade, knowledge and partnerships.", "image": {"url": "/kadik/is-hakkimizda.webp", "assetId": null}}'::jsonb), "updatedAt" = CURRENT_TIMESTAMP
WHERE "key" = 'about' AND coalesce("data"->'seo'->>'title', '') IN ('About Us | KADİK', '') AND coalesce("data"->'seo'->>'description', '') IN ('', '');
UPDATE "KadikPageContent" SET "data" = jsonb_set("data", '{seo,image}', '{"url": "/kadik/is-hakkimizda.webp", "assetId": null}'::jsonb), "updatedAt" = CURRENT_TIMESTAMP
WHERE "key" = 'about' AND "data" ? 'seo' AND NOT ("data"->'seo' ? 'image');
UPDATE "KadikPageContent" SET "data" = jsonb_set("data", '{seo}', '{"title": "Board Members | KADİK London Business Council", "description": "Meet the KADİK board: business leaders from different sectors guiding the Kybele Atasever World Business Council''s programmes and partnerships.", "image": {"url": "/kadik/is-hakkimizda.webp", "assetId": null}}'::jsonb), "updatedAt" = CURRENT_TIMESTAMP
WHERE "key" = 'board' AND coalesce("data"->'seo'->>'title', '') IN ('Board Members | KADİK', '') AND coalesce("data"->'seo'->>'description', '') IN ('', '');
UPDATE "KadikPageContent" SET "data" = jsonb_set("data", '{seo,image}', '{"url": "/kadik/is-hakkimizda.webp", "assetId": null}'::jsonb), "updatedAt" = CURRENT_TIMESTAMP
WHERE "key" = 'board' AND "data" ? 'seo' AND NOT ("data"->'seo' ? 'image');
UPDATE "KadikPageContent" SET "data" = jsonb_set("data", '{seo}', '{"title": "Events & Calendar | KADİK London", "description": "Upcoming KADİK events in London and beyond: sector board meetings, export panels, networking meet-ups and finance workshops for members.", "image": {"url": "/kadik/is-band.webp", "assetId": null}}'::jsonb), "updatedAt" = CURRENT_TIMESTAMP
WHERE "key" = 'events' AND coalesce("data"->'seo'->>'title', '') IN ('Events | KADİK', '') AND coalesce("data"->'seo'->>'description', '') IN ('', '');
UPDATE "KadikPageContent" SET "data" = jsonb_set("data", '{seo,image}', '{"url": "/kadik/is-band.webp", "assetId": null}'::jsonb), "updatedAt" = CURRENT_TIMESTAMP
WHERE "key" = 'events' AND "data" ? 'seo' AND NOT ("data"->'seo' ? 'image');
UPDATE "KadikPageContent" SET "data" = jsonb_set("data", '{seo}', '{"title": "Announcements | KADİK London", "description": "KADİK announcements on sector boards, membership, international business opportunities, trade delegations and training programmes.", "image": {"url": "/kadik/is-band.webp", "assetId": null}}'::jsonb), "updatedAt" = CURRENT_TIMESTAMP
WHERE "key" = 'announcements' AND coalesce("data"->'seo'->>'title', '') IN ('Announcements | KADİK', '') AND coalesce("data"->'seo'->>'description', '') IN ('', '');
UPDATE "KadikPageContent" SET "data" = jsonb_set("data", '{seo,image}', '{"url": "/kadik/is-band.webp", "assetId": null}'::jsonb), "updatedAt" = CURRENT_TIMESTAMP
WHERE "key" = 'announcements' AND "data" ? 'seo' AND NOT ("data"->'seo' ? 'image');
UPDATE "KadikPageContent" SET "data" = jsonb_set("data", '{seo}', '{"title": "News & Insights | KADİK London", "description": "News, articles and assessments from the Kybele Atasever World Business Council on trade, sector boards and international business.", "image": {"url": "/kadik/is-galeri-2.webp", "assetId": null}}'::jsonb), "updatedAt" = CURRENT_TIMESTAMP
WHERE "key" = 'news' AND coalesce("data"->'seo'->>'title', '') IN ('News | KADİK', '') AND coalesce("data"->'seo'->>'description', '') IN ('', '');
UPDATE "KadikPageContent" SET "data" = jsonb_set("data", '{seo,image}', '{"url": "/kadik/is-galeri-2.webp", "assetId": null}'::jsonb), "updatedAt" = CURRENT_TIMESTAMP
WHERE "key" = 'news' AND "data" ? 'seo' AND NOT ("data"->'seo' ? 'image');
UPDATE "KadikPageContent" SET "data" = jsonb_set("data", '{seo}', '{"title": "Membership Application | Join KADİK London", "description": "Apply to join the Kybele Atasever World Business Council. Share your company and sector details and connect with sector boards and new partners.", "image": {"url": "/kadik/is-band.webp", "assetId": null}}'::jsonb), "updatedAt" = CURRENT_TIMESTAMP
WHERE "key" = 'membership' AND coalesce("data"->'seo'->>'title', '') IN ('Membership Application | KADİK', '') AND coalesce("data"->'seo'->>'description', '') IN ('Kybele Atasever World Business Council membership application: share your company and sector details, and join a sector board after secretariat review.', '');
UPDATE "KadikPageContent" SET "data" = jsonb_set("data", '{seo,image}', '{"url": "/kadik/is-band.webp", "assetId": null}'::jsonb), "updatedAt" = CURRENT_TIMESTAMP
WHERE "key" = 'membership' AND "data" ? 'seo' AND NOT ("data"->'seo' ? 'image');
UPDATE "KadikPageContent" SET "data" = jsonb_set("data", '{seo}', '{"title": "Photo Gallery | KADİK London", "description": "Photos from KADİK events, sector board meetings and business trips, showing the Kybele Atasever World Business Council in action.", "image": {"url": "/kadik/is-galeri-1.webp", "assetId": null}}'::jsonb), "updatedAt" = CURRENT_TIMESTAMP
WHERE "key" = 'gallery' AND coalesce("data"->'seo'->>'title', '') IN ('Gallery | KADİK', '') AND coalesce("data"->'seo'->>'description', '') IN ('', '');
UPDATE "KadikPageContent" SET "data" = jsonb_set("data", '{seo,image}', '{"url": "/kadik/is-galeri-1.webp", "assetId": null}'::jsonb), "updatedAt" = CURRENT_TIMESTAMP
WHERE "key" = 'gallery' AND "data" ? 'seo' AND NOT ("data"->'seo' ? 'image');
UPDATE "KadikPageContent" SET "data" = jsonb_set("data", '{seo}', '{"title": "Contact KADİK | London Council Secretariat", "description": "Contact the KADİK secretariat in London about membership, sector boards, events and international business connections.", "image": {"url": "/kadik/is-hero.webp", "assetId": null}}'::jsonb), "updatedAt" = CURRENT_TIMESTAMP
WHERE "key" = 'contact' AND coalesce("data"->'seo'->>'title', '') IN ('Contact | KADİK', '') AND coalesce("data"->'seo'->>'description', '') IN ('', '');
UPDATE "KadikPageContent" SET "data" = jsonb_set("data", '{seo,image}', '{"url": "/kadik/is-hero.webp", "assetId": null}'::jsonb), "updatedAt" = CURRENT_TIMESTAMP
WHERE "key" = 'contact' AND "data" ? 'seo' AND NOT ("data"->'seo' ? 'image');
UPDATE "KadikPageContent" SET "data" = jsonb_set("data", '{seo}', '{"title": "Privacy Policy | KADİK London", "description": "How the Kybele Atasever World Business Council collects, uses and protects personal data submitted through the KADİK website and its forms.", "image": {"url": "/kadik/is-hero.webp", "assetId": null}}'::jsonb), "updatedAt" = CURRENT_TIMESTAMP
WHERE "key" = 'privacy' AND coalesce("data"->'seo'->>'title', '') IN ('Privacy Policy | KADİK', '') AND coalesce("data"->'seo'->>'description', '') IN ('', '');
UPDATE "KadikPageContent" SET "data" = jsonb_set("data", '{seo,image}', '{"url": "/kadik/is-hero.webp", "assetId": null}'::jsonb), "updatedAt" = CURRENT_TIMESTAMP
WHERE "key" = 'privacy' AND "data" ? 'seo' AND NOT ("data"->'seo' ? 'image');
UPDATE "KadikPageContent" SET "data" = jsonb_set("data", '{seo}', '{"title": "Terms of Use | KADİK London", "description": "The terms that apply when you use the KADİK website, including acceptable use, content, external links and how these terms may change.", "image": {"url": "/kadik/is-hero.webp", "assetId": null}}'::jsonb), "updatedAt" = CURRENT_TIMESTAMP
WHERE "key" = 'terms' AND coalesce("data"->'seo'->>'title', '') IN ('Terms of Use | KADİK', '') AND coalesce("data"->'seo'->>'description', '') IN ('', '');
UPDATE "KadikPageContent" SET "data" = jsonb_set("data", '{seo,image}', '{"url": "/kadik/is-hero.webp", "assetId": null}'::jsonb), "updatedAt" = CURRENT_TIMESTAMP
WHERE "key" = 'terms' AND "data" ? 'seo' AND NOT ("data"->'seo' ? 'image');
UPDATE "KadikPageContent" SET "data" = jsonb_set("data", '{seo}', '{"title": "Charter | Kybele Atasever World Business Council", "description": "The KADİK charter: the council''s name, purpose, governance, General Assembly, Board of Directors, finances and rules for amendment.", "image": {"url": "/kadik/is-hakkimizda.webp", "assetId": null}}'::jsonb), "updatedAt" = CURRENT_TIMESTAMP
WHERE "key" = 'charter' AND coalesce("data"->'seo'->>'title', '') IN ('Charter | KADİK', '') AND coalesce("data"->'seo'->>'description', '') IN ('', '');
UPDATE "KadikPageContent" SET "data" = jsonb_set("data", '{seo,image}', '{"url": "/kadik/is-hakkimizda.webp", "assetId": null}'::jsonb), "updatedAt" = CURRENT_TIMESTAMP
WHERE "key" = 'charter' AND "data" ? 'seo' AND NOT ("data"->'seo' ? 'image');
UPDATE "KadikPageContent" SET "data" = jsonb_set("data", '{seo}', '{"title": "Page Not Found | KADİK London", "description": "The page you''re looking for could not be found or may have moved. You can reach the council sections from here.", "image": {"url": "/kadik/is-hero.webp", "assetId": null}}'::jsonb), "updatedAt" = CURRENT_TIMESTAMP
WHERE "key" = 'notFound' AND coalesce("data"->'seo'->>'title', '') IN ('Page Not Found | KADİK', '') AND coalesce("data"->'seo'->>'description', '') IN ('The page you''re looking for could not be found or may have moved. You can reach the council sections from here.', '');
UPDATE "KadikPageContent" SET "data" = jsonb_set("data", '{seo,image}', '{"url": "/kadik/is-hero.webp", "assetId": null}'::jsonb), "updatedAt" = CURRENT_TIMESTAMP
WHERE "key" = 'notFound' AND "data" ? 'seo' AND NOT ("data"->'seo' ? 'image');

UPDATE "ContentTranslationRevision" r SET "payload" = r."payload" || jsonb_build_object('seoTitle', 'Shared-Growth Export Model for SMEs | KADİK'::text, 'seoDescription', 'How shared procurement, market intelligence and joint representation help mid-sized firms grow exports: insights from KADİK''s sector boards.'::text)
FROM "ContentTranslation" t JOIN "ContentEntity" e ON e."id" = t."entityId"
WHERE r."translationId" = t."id" AND t."locale" = 'en' AND e."contentType" = 'post'
  AND r."id" IN (t."publishedRevisionId", t."draftRevisionId")
  AND r."payload"->>'title' = 'From production to export: a shared-growth model for SMEs'
  AND coalesce(r."payload"->>'seoTitle', '') = '' AND coalesce(r."payload"->>'seoDescription', '') = '';
UPDATE "ContentTranslationRevision" r SET "payload" = r."payload" || jsonb_build_object('seoTitle', 'Sector Boards Begin 2026 Term Meetings | KADİK'::text, 'seoDescription', 'KADİK sector boards meet monthly in 2026 on supply chains, export finance and skilled workforce. See the agenda and how members can take part.'::text)
FROM "ContentTranslation" t JOIN "ContentEntity" e ON e."id" = t."entityId"
WHERE r."translationId" = t."id" AND t."locale" = 'en' AND e."contentType" = 'post'
  AND r."id" IN (t."publishedRevisionId", t."draftRevisionId")
  AND r."payload"->>'title' = 'Sector boards begin their 2026 term meetings'
  AND coalesce(r."payload"->>'seoTitle', '') = '' AND coalesce(r."payload"->>'seoDescription', '') = '';
