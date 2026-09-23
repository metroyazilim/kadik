import "server-only";
import type { Metadata } from "next";
import { cache } from "react";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { hasDatabase } from "@/lib/env";
import { SITE_URL } from "@/lib/i18n/config";
import { KADIK_DICT, KADIK_STATIC_IMAGE_ROOT, type KadikDictionary, type KadikImage } from "@/lib/kadik-i18n";
import { getAtPath } from "./fields";
import {
  KADIK_CONTENT_KEYS,
  KADIK_PAGE_DEFINITIONS,
  kadikPageDefaults,
  type KadikContentKey,
  type KadikPageData,
  type KadikSeo,
} from "./pages";
import { collectKadikImages, replaceKadikImage, sanitizeKadikPageData } from "./sanitize";

export const KADIK_MEDIA_SURFACE = "kadik-page";

export type KadikSiteContent = Readonly<{
  dict: KadikDictionary;
  seo: Readonly<Record<KadikContentKey, KadikSeo>>;
}>;

/** Bundled images an editor may keep without picking a library asset. */
const STATIC_IMAGE_URLS: ReadonlySet<string> = new Set(
  KADIK_CONTENT_KEYS.flatMap((key) => collectKadikImages(key, kadikPageDefaults(key)).map(({ image }) => image.url)),
);

function isAllowedStaticImage(url: string): boolean {
  return url === "" || (url.startsWith(KADIK_STATIC_IMAGE_ROOT) && STATIC_IMAGE_URLS.has(url));
}

/**
 * Points every library image at the asset's current URL. An asset that was
 * deleted or archived falls back to the URL captured at save time, so the
 * page never renders a hole because of a media-library action.
 */
async function resolveImages(entries: readonly Readonly<{ key: KadikContentKey; data: KadikPageData }>[]) {
  const ids = new Set<string>();
  for (const { key, data } of entries) {
    for (const { image } of collectKadikImages(key, data)) if (image.assetId) ids.add(image.assetId);
  }
  if (ids.size === 0) return entries;
  const assets = await prisma.mediaAsset.findMany({
    where: { id: { in: [...ids] }, archivedAt: null },
    select: { id: true, url: true },
  });
  const urls = new Map(assets.map((asset) => [asset.id, asset.url]));
  return entries.map(({ key, data }) => {
    let next = data;
    for (const { path, image } of collectKadikImages(key, data)) {
      const current = image.assetId ? urls.get(image.assetId) : undefined;
      if (current && current !== image.url) next = replaceKadikImage(next, path, { ...image, url: current });
    }
    return { key, data: next };
  });
}

async function readAllPages(): Promise<readonly Readonly<{ key: KadikContentKey; data: KadikPageData }>[]> {
  let rows: readonly Readonly<{ key: string; data: unknown }>[] = [];
  if (hasDatabase()) {
    try {
      rows = await prisma.kadikPageContent.findMany({ select: { key: true, data: true } });
    } catch (error) {
      // A missing migration or an unreachable database must never take the public site down.
      console.error("KADIK page content could not be read; showing defaults.", error);
    }
  }
  const stored = new Map(rows.map((row) => [row.key, row.data]));
  const entries = KADIK_CONTENT_KEYS.map((key) => ({ key, data: sanitizeKadikPageData(key, stored.get(key)) }));
  return resolveImages(entries).catch(() => entries);
}

/**
 * The live site content: factory defaults with every admin-saved page
 * merged on top. Cached per request so the page body and `generateMetadata`
 * share one database round trip.
 */
export const getKadikSiteContent = cache(async (): Promise<KadikSiteContent> => {
  const pages = await readAllPages();
  const dict: Record<string, unknown> = { ...KADIK_DICT.en };
  const seo = {} as Record<KadikContentKey, KadikSeo>;
  for (const { key, data } of pages) {
    const definition = KADIK_PAGE_DEFINITIONS[key];
    for (const slice of definition.slices) dict[slice] = data[slice];
    const pageSeo = getAtPath(data, "seo") as KadikSeo | undefined;
    seo[key] = pageSeo ?? definition.seoDefaults;
  }
  return { dict: dict as KadikDictionary, seo };
});

/** Default share image when a page has none of its own. */
const FALLBACK_SHARE_IMAGE = "/kadik/is-hero.webp";

function absoluteUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return new URL(path, SITE_URL).toString();
}

/**
 * Page metadata from the admin SEO screen: title, description, canonical
 * address and Open Graph / X (Twitter) cards with the page's share image.
 * An empty title falls back to the page default; an empty description is omitted.
 */
export async function kadikMetadata(key: KadikContentKey): Promise<Metadata> {
  const { seo } = await getKadikSiteContent();
  const definition = KADIK_PAGE_DEFINITIONS[key];
  const entry = seo[key];
  const title = entry.title.trim() || definition.seoDefaults.title;
  const description = entry.description.trim() || undefined;
  const image = absoluteUrl(entry.image?.url || definition.seoDefaults.image.url || FALLBACK_SHARE_IMAGE);
  const canonical = key === "notFound" || !definition.publicPath ? undefined : absoluteUrl(definition.publicPath);
  return {
    title,
    description,
    ...(canonical ? { alternates: { canonical } } : {}),
    openGraph: {
      type: "website",
      siteName: "KADİK London",
      locale: "en_GB",
      title,
      description,
      ...(canonical ? { url: canonical } : {}),
      images: [{ url: image }],
    },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

/* ------------------------------------------------------------------ Admin */

export type KadikPageSummary = Readonly<{ key: KadikContentKey; updatedAt: Date | null }>;

export async function listKadikPageSummaries(): Promise<readonly KadikPageSummary[]> {
  const rows = await prisma.kadikPageContent.findMany({ select: { key: true, updatedAt: true } });
  const updated = new Map(rows.map((row) => [row.key, row.updatedAt]));
  return KADIK_CONTENT_KEYS.map((key) => ({ key, updatedAt: updated.get(key) ?? null }));
}

export async function getKadikPageForEdit(key: KadikContentKey): Promise<Readonly<{ data: KadikPageData; updatedAt: Date | null }>> {
  const row = await prisma.kadikPageContent.findUnique({ where: { key }, select: { data: true, updatedAt: true } });
  const [resolved] = await resolveImages([{ key, data: sanitizeKadikPageData(key, row?.data) }]);
  return { data: resolved.data, updatedAt: row?.updatedAt ?? null };
}

export class KadikContentError extends Error {}

/**
 * Validates and publishes one page. Library images are re-read from the
 * database (the client-sent URL is never trusted), bundled images must be
 * one of the shipped defaults, and `MediaUsage` rows are rewritten in the
 * same transaction so the media library refuses to delete an image that is
 * live on a page.
 */
export async function saveKadikPage(
  key: KadikContentKey,
  input: unknown,
  actorId: string,
  options: Readonly<{ keepStoredSeo?: boolean }> = {},
): Promise<void> {
  let data = sanitizeKadikPageData(key, input);
  if (options.keepStoredSeo && KADIK_PAGE_DEFINITIONS[key].hasSeo) {
    // SEO is owned by the SEO screen; a page-content save never overwrites it.
    const stored = await prisma.kadikPageContent.findUnique({ where: { key }, select: { data: true } });
    const storedSeo = getAtPath(sanitizeKadikPageData(key, stored?.data), "seo");
    data = { ...data, seo: storedSeo };
  }
  const images = collectKadikImages(key, data);
  const assetIds = [...new Set(images.flatMap(({ image }) => (image.assetId ? [image.assetId] : [])))];
  const assets = assetIds.length
    ? await prisma.mediaAsset.findMany({ where: { id: { in: assetIds } }, select: { id: true, url: true, archivedAt: true } })
    : [];
  const byId = new Map(assets.map((asset) => [asset.id, asset]));

  for (const { path, image } of images) {
    if (image.assetId) {
      const asset = byId.get(image.assetId);
      if (!asset) throw new KadikContentError(`Seçilen görsel bulunamadı (${path}).`);
      if (asset.archivedAt) throw new KadikContentError(`Arşivlenmiş görsel kullanılamaz (${path}).`);
      data = replaceKadikImage(data, path, { url: asset.url, assetId: asset.id });
    } else if (!isAllowedStaticImage(image.url)) {
      throw new KadikContentError(`Görsel yalnızca medya kütüphanesinden seçilebilir (${path}).`);
    }
  }

  const usageField = (path: string) => `${key}:${path}`;
  await prisma.$transaction(async (tx) => {
    await tx.kadikPageContent.upsert({
      where: { key },
      create: { key, data: data as Prisma.InputJsonValue, updatedById: actorId },
      update: { data: data as Prisma.InputJsonValue, updatedById: actorId },
    });
    await tx.mediaUsage.deleteMany({ where: { surface: KADIK_MEDIA_SURFACE, field: { startsWith: `${key}:` } } });
    const usages = collectKadikImages(key, data).flatMap(({ path, image }) =>
      image.assetId ? [{ assetId: image.assetId, surface: KADIK_MEDIA_SURFACE, field: usageField(path) }] : [],
    );
    if (usages.length) await tx.mediaUsage.createMany({ data: usages });
    await tx.auditLog.create({
      data: {
        action: "kadik.page.publish",
        entity: "KadikPageContent",
        entityId: key,
        userId: actorId,
        metadata: { imageCount: usages.length },
      },
    });
  });
}

/** Writes factory defaults for every page that has no row yet. Idempotent. */
export async function ensureKadikPagesSeeded(): Promise<number> {
  const existing = new Set((await prisma.kadikPageContent.findMany({ select: { key: true } })).map((row) => row.key));
  const missing = KADIK_CONTENT_KEYS.filter((key) => !existing.has(key));
  if (missing.length === 0) return 0;
  await prisma.kadikPageContent.createMany({
    data: missing.map((key) => ({ key, data: kadikPageDefaults(key) as Prisma.InputJsonValue })),
    skipDuplicates: true,
  });
  return missing.length;
}

/* -------------------------------------------------------------------- SEO */

export type KadikSeoRow = Readonly<{ key: KadikContentKey; seo: KadikSeo; defaults: KadikSeo; updatedAt: Date | null }>;

/** Every page with its own URL, with the SEO title/description currently live. */
export async function listKadikSeo(): Promise<readonly KadikSeoRow[]> {
  const rows = await prisma.kadikPageContent.findMany({ select: { key: true, data: true, updatedAt: true } });
  const byKey = new Map(rows.map((row) => [row.key, row]));
  return KADIK_CONTENT_KEYS.filter((key) => KADIK_PAGE_DEFINITIONS[key].hasSeo).map((key) => {
    const row = byKey.get(key);
    const data = sanitizeKadikPageData(key, row?.data);
    return {
      key,
      seo: (getAtPath(data, "seo") as KadikSeo | undefined) ?? KADIK_PAGE_DEFINITIONS[key].seoDefaults,
      defaults: KADIK_PAGE_DEFINITIONS[key].seoDefaults,
      updatedAt: row?.updatedAt ?? null,
    };
  });
}

/** Updates only the SEO title/description of one page; the rest of its content is untouched. */
export async function saveKadikSeo(key: KadikContentKey, seo: unknown, actorId: string): Promise<void> {
  if (!KADIK_PAGE_DEFINITIONS[key].hasSeo) throw new KadikContentError("Bu kaydın SEO ayarı yok.");
  const stored = await prisma.kadikPageContent.findUnique({ where: { key }, select: { data: true } });
  const current = sanitizeKadikPageData(key, stored?.data);
  await saveKadikPage(key, { ...current, seo }, actorId);
}
