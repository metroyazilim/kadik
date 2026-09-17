/**
 * Publishes English translations for the board members and posts that
 * `seed-kadik-content.ts` already published in Turkish. Reuses the same
 * entities (same `imageAssetId`, same underlying `ContentEntity`) - only a
 * second `ContentTranslation` (locale "en") is created and published, via
 * the exact same `ensureLocaleTranslation` -> `adminSaveDraft` ->
 * `adminPublish` path the admin panel itself uses.
 *
 * Usage: npx tsx scripts/seed-kadik-content-en.ts
 * Idempotent: an entity that already has a published English translation
 * is skipped.
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/db";
import type { AdminContext } from "../lib/content-model/admin-context";
import { adminPublish, adminSaveDraft } from "../lib/content-model/admin-content-store";
import { ensureLocaleTranslation } from "../lib/content-model/collection-admin";
import { contentAvailabilityTag, contentEntityTag, seoIndexTag } from "../lib/content-model/cache-tags";
import { syncFieldMediaUsage } from "../lib/content-model/content-media";
import type { ContentBlock } from "../lib/content-model/content-blocks";
import { persistedOutboxRecorder } from "../lib/content-model/outbox-store";
import {
  POST_CONTENT_TYPE,
  POST_SCHEMA_VERSION,
  TEAM_MEMBER_CONTENT_TYPE,
  TEAM_MEMBER_SCHEMA_VERSION,
  type PostPayload,
  type TeamMemberPayload,
} from "../lib/content-model/payload-validation";
import { postRouteCandidate } from "../lib/content-model/post-routes";
import { slugifyTitle } from "../lib/content-model/slugify";
import { teamMemberRouteCandidate } from "../lib/content-model/team-routes";
import { scriptAdminContext } from "./media-import";

const EN = "en" as const;

const BOARD_EN: Record<string, { role: string; bio: string }> = {
  "bob-farmer": {
    role: "Chairman of the Board",
    bio: "Draws on decades of international trade and investment experience to lead the council's external representation agenda. Helped establish the partnership programmes that support member companies expanding into new markets.",
  },
  "yasar-karadag": {
    role: "Vice Chairman",
    bio: "Brings hands-on industrial and manufacturing experience to the council's sector board work. Responsible for building supply and partnership connections between members.",
  },
  "taylan-engin": {
    role: "Board Member",
    bio: "Coordinates mentoring programmes for young entrepreneurs and technology-focused companies. Prepares training content for members on digitalisation and efficiency.",
  },
  "ali-ayter": {
    role: "Board Member",
    bio: "Leads the working group guiding member companies on access to finance, incentive schemes and investment planning. Involved in the council's budget and audit processes.",
  },
  "ilyas-karabiyik": {
    role: "Board Member",
    bio: "Contributes logistics and foreign-trade operations experience to the planning of export delegations. Takes charge of organising regional business meetings.",
  },
  "orhan-selim-bayraktar": {
    role: "Board Member",
    bio: "Takes part in shaping council policy on corporate governance, human resources and working life. Leads advisory meetings for member companies.",
  },
};

const POSTS_EN: readonly {
  trSlug: string;
  title: string;
  excerpt: string;
  category: string;
  author: string;
  blocks: (inlineImageAssetId: string | null) => readonly ContentBlock[];
}[] = [
  {
    trSlug: "uretimden-ihracata-kobi-ler-icin-birlikte-buyume-modeli",
    title: "From production to export: a shared-growth model for SMEs",
    excerpt:
      "Rather than growing alone, shared procurement, shared market research and shared representation help mid-sized companies gain a lasting foothold abroad.",
    category: "Article",
    author: "KADİK Secretariat",
    blocks: (inlineImageAssetId) => [
      {
        id: "giris",
        type: "text",
        html: "<p>The problem mid-sized companies face in foreign markets is rarely product quality - it's usually scale, representation and access to finance. Costs that are hard for a single company to carry alone - trade fair participation, market research, certification - become manageable once a few companies from the same sector join forces.</p><p>In our council's work, three themes stand out: <strong>shared procurement</strong>, <strong>shared market intelligence</strong> and <strong>institutional capacity</strong>. These three themes also form the backbone of the agenda our members bring to the sector boards.</p>",
      },
      {
        id: "hedefler",
        type: "kpi",
        heading: "Our 2026 targets",
        items: [
          { label: "Sector boards", value: "12" },
          { label: "Member meet-ups", value: "24" },
          { label: "Export delegations", value: "6" },
          { label: "Training programmes", value: "18" },
        ],
      },
      {
        id: "ortak-tedarik",
        type: "text",
        html: "<h3>Shared procurement creates scale</h3><p>Members who buy raw materials and packaging jointly improve both unit costs and delivery times. Sector boards run a transparent calendar for these purchases; results are shared with members in the period reports.</p><h3>Shared market intelligence pays off</h3><p>Regulatory, customs and distribution-channel knowledge from target markets no longer stays with a single company - it becomes part of the board's reporting. What a member learns entering a new market becomes the roadmap for the next member to follow.</p>",
      },
      ...(inlineImageAssetId
        ? [{ id: "kurul-gorsel", type: "image" as const, assetId: inlineImageAssetId, caption: "A sector board working meeting." }]
        : []),
      {
        id: "alinti",
        type: "quote",
        text: "The arena we compete in should be the product; the arena we cooperate in should be infrastructure, knowledge and representation.",
        author: "KADİK Sector Boards Working Note",
      },
      {
        id: "kapanis",
        type: "text",
        html: "<h3>Institutional capacity determines staying power</h3><p>Without strong financial reporting, contract management and HR processes, staying power in foreign markets isn't possible. That's why we align our training programmes with the sector boards' agendas and update them each period based on participant feedback.</p>",
      },
      {
        id: "cta",
        type: "banner",
        heading: "Join a sector board",
        text: "Once your membership application is complete, you'll be invited to the sector board closest to your field of activity.",
        imageAssetId: null,
        ctaLabel: "Membership application",
        ctaUrl: "/membership",
      },
    ],
  },
  {
    trSlug: "sektor-kurullari-2026-donem-toplantilari-basliyor",
    title: "Sector boards begin their 2026 term meetings",
    excerpt:
      "This term, sector boards will meet on a monthly schedule; the agenda covers supply chains, export finance and skilled workforce.",
    category: "News",
    author: "KADİK Secretariat",
    blocks: () => [
      {
        id: "duyuru",
        type: "text",
        html: "<p>The council's sector boards are starting their 2026 term work. This term the boards will meet on a monthly schedule; the outcome of every meeting will turn into a short agenda note shared with members.</p><p>The topics leading the first round are:</p><ul><li>Alternative sourcing planning in supply chains</li><li>Shared guidance on export finance and incentive applications</li><li>Skilled workforce and vocational training partnerships</li><li>Measurable efficiency in digitalisation investment</li></ul>",
      },
      {
        id: "katilim",
        type: "text",
        html: "<h3>Participation and schedule</h3><p>Meeting venues and times are sent to members by email; the current calendar is published on the events page. Companies wishing to join a sector board's work are directed to the right board once their membership application is complete.</p>",
      },
      {
        id: "cta",
        type: "banner",
        heading: "Follow the calendar",
        text: "All event and meeting announcements are listed on the council's events calendar.",
        imageAssetId: null,
        ctaLabel: "Events calendar",
        ctaUrl: "/events",
      },
    ],
  },
];

async function publishEnglishTeamMember(context: AdminContext, slug: string, role: string, bio: string): Promise<void> {
  const existingEn = await prisma.contentRoute.findFirst({
    where: { contentType: TEAM_MEMBER_CONTENT_TYPE, locale: EN, collectionSegment: "team" },
    select: { entityId: true },
  });
  const route = await prisma.contentRoute.findUnique({
    where: { contentType_locale_collectionSegment_slug: { contentType: TEAM_MEMBER_CONTENT_TYPE, locale: "tr", collectionSegment: "ekip", slug } },
    select: { entityId: true },
  });
  if (!route) { console.warn(`- tr entity not found for team slug: ${slug}`); return; }

  const alreadyEn = await prisma.contentTranslation.findUnique({
    where: { entityId_locale: { entityId: route.entityId, locale: EN } },
    select: { publishedRevisionId: true },
  });
  if (alreadyEn?.publishedRevisionId) { console.log(`- skipped (already EN published): ${slug}`); return; }

  const trTranslation = await prisma.contentTranslation.findUnique({
    where: { entityId_locale: { entityId: route.entityId, locale: "tr" } },
    include: { publishedRevision: true },
  });
  const trPayload = trTranslation?.publishedRevision?.payload as unknown as TeamMemberPayload | undefined;
  if (!trPayload) { console.warn(`- no published tr payload for: ${slug}`); return; }

  const payload: TeamMemberPayload = { ...trPayload, role, bio, seoTitle: null, seoDescription: null };
  const translation = await ensureLocaleTranslation(prisma, context, route.entityId, EN);
  const draft = await adminSaveDraft(prisma, context, {
    translationId: translation.translationId,
    expectedVersion: translation.version,
    schemaVersion: TEAM_MEMBER_SCHEMA_VERSION,
    payload: payload as unknown as Prisma.InputJsonValue,
  });
  if (!draft.ok) throw new Error(`Draft save failed for ${slug}`);
  const published = await adminPublish(
    prisma,
    context,
    { translationId: translation.translationId, expectedVersion: draft.translation.version, expectedDraftRevisionId: draft.revisionId },
    { candidate: teamMemberRouteCandidate(EN, slug) },
    { recorder: persistedOutboxRecorder, tags: [contentEntityTag(route.entityId), contentAvailabilityTag(route.entityId, EN), "team-member:collection", seoIndexTag()] },
  );
  if (!published.ok) throw new Error(`Publish failed for ${slug}`);
  await syncFieldMediaUsage(prisma, { entityId: route.entityId, locale: EN, surface: TEAM_MEMBER_CONTENT_TYPE, field: "image", assetIds: [payload.imageAssetId] });
  console.log(`+ EN published: ${slug} (${role})${existingEn ? "" : ""}`);
}

async function publishEnglishPost(context: AdminContext, input: (typeof POSTS_EN)[number]): Promise<void> {
  const route = await prisma.contentRoute.findUnique({
    where: { contentType_locale_collectionSegment_slug: { contentType: POST_CONTENT_TYPE, locale: "tr", collectionSegment: "blog", slug: input.trSlug } },
    select: { entityId: true },
  });
  if (!route) { console.warn(`- tr entity not found for post slug: ${input.trSlug}`); return; }

  const alreadyEn = await prisma.contentTranslation.findUnique({
    where: { entityId_locale: { entityId: route.entityId, locale: EN } },
    select: { publishedRevisionId: true },
  });
  if (alreadyEn?.publishedRevisionId) { console.log(`- skipped (already EN published): ${input.trSlug}`); return; }

  const trTranslation = await prisma.contentTranslation.findUnique({
    where: { entityId_locale: { entityId: route.entityId, locale: "tr" } },
    include: { publishedRevision: true },
  });
  const trPayload = trTranslation?.publishedRevision?.payload as unknown as PostPayload | undefined;
  if (!trPayload) { console.warn(`- no published tr payload for: ${input.trSlug}`); return; }

  const inlineAssetId = trPayload.blocks.find((block) => block.type === "image")?.assetId ?? null;
  const slug = slugifyTitle(input.title);
  const payload: PostPayload = {
    title: input.title,
    slug,
    excerpt: input.excerpt,
    blocks: input.blocks(inlineAssetId),
    category: input.category,
    author: input.author,
    coverImageAssetId: trPayload.coverImageAssetId,
    seoTitle: null,
    seoDescription: null,
  };

  const translation = await ensureLocaleTranslation(prisma, context, route.entityId, EN);
  const draft = await adminSaveDraft(prisma, context, {
    translationId: translation.translationId,
    expectedVersion: translation.version,
    schemaVersion: POST_SCHEMA_VERSION,
    payload: payload as unknown as Prisma.InputJsonValue,
  });
  if (!draft.ok) throw new Error(`Draft save failed for ${input.trSlug}`);
  const published = await adminPublish(
    prisma,
    context,
    { translationId: translation.translationId, expectedVersion: draft.translation.version, expectedDraftRevisionId: draft.revisionId },
    { candidate: postRouteCandidate(EN, slug) },
    { recorder: persistedOutboxRecorder, tags: [contentEntityTag(route.entityId), contentAvailabilityTag(route.entityId, EN), "post:collection", seoIndexTag()] },
  );
  if (!published.ok) throw new Error(`Publish failed for ${input.trSlug}`);
  await syncFieldMediaUsage(prisma, { entityId: route.entityId, locale: EN, surface: POST_CONTENT_TYPE, field: "blocks", assetIds: [payload.coverImageAssetId, inlineAssetId] });
  console.log(`+ EN published: ${input.title} -> /news/${slug}`);
}

async function run(): Promise<void> {
  const context = await scriptAdminContext();
  console.log("Publishing English board member translations...");
  for (const [slug, { role, bio }] of Object.entries(BOARD_EN)) await publishEnglishTeamMember(context, slug, role, bio);
  console.log("Publishing English post translations...");
  for (const post of POSTS_EN) await publishEnglishPost(context, post);
  console.log("Done.");
}

run()
  .catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
