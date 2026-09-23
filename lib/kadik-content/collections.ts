import "server-only";
import { prisma } from "@/lib/db";
import { hasDatabase } from "@/lib/env";
import { sanitizeRichHtml, stripHtmlToText } from "@/lib/content-model/sanitization";
import {
  DATE_PATTERN,
  TIME_PATTERN,
  type KadikAnnouncementView,
  type KadikEventView,
  type KadikGalleryItemView,
} from "./collection-types";
import { KadikContentError } from "./store";

/**
 * Events, announcements and gallery photos: real records with their own
 * admin screens (not page copy). Public readers return only published rows
 * and resolve library images to their current URL.
 */

export const EVENT_MEDIA_SURFACE = "kadik-event";
export const GALLERY_MEDIA_SURFACE = "kadik-gallery";

async function assetUrls(ids: readonly (string | null)[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (unique.length === 0) return new Map();
  const assets = await prisma.mediaAsset.findMany({ where: { id: { in: unique }, archivedAt: null }, select: { id: true, url: true } });
  return new Map(assets.map((asset) => [asset.id, asset.url]));
}

async function safely<T>(fallback: T, read: () => Promise<T>): Promise<T> {
  if (!hasDatabase()) return fallback;
  try {
    return await read();
  } catch (error) {
    console.error("KADIK collection read failed", error);
    return fallback;
  }
}

/* ----------------------------------------------------------------- Public */

export function listPublicEvents(): Promise<KadikEventView[]> {
  return safely([], async () => {
    const rows = await prisma.kadikEvent.findMany({ where: { published: true }, orderBy: [{ date: "asc" }, { startTime: "asc" }] });
    const urls = await assetUrls(rows.map((row) => row.imageAssetId));
    return rows.map((row) => toEventView(row, urls));
  });
}

export function getPublicEvent(id: string): Promise<KadikEventView | null> {
  return safely(null, async () => {
    const row = await prisma.kadikEvent.findFirst({ where: { id, published: true } });
    if (!row) return null;
    return toEventView(row, await assetUrls([row.imageAssetId]));
  });
}

type EventRow = Awaited<ReturnType<typeof prisma.kadikEvent.findFirstOrThrow>>;

function toEventView(row: EventRow, urls: Map<string, string>): KadikEventView {
  const html = row.description ? sanitizeRichHtml(row.description) : "";
  return {
    id: row.id,
    title: row.title,
    date: row.date,
    startTime: row.startTime,
    endTime: row.endTime,
    location: row.location,
    descriptionHtml: stripHtmlToText(html).trim() ? html : null,
    image: (row.imageAssetId && urls.get(row.imageAssetId)) || row.imageUrl || null,
    registrationUrl: row.registrationUrl,
  };
}

export function listPublicAnnouncements(): Promise<KadikAnnouncementView[]> {
  return safely([], async () => {
    const rows = await prisma.kadikAnnouncement.findMany({ where: { published: true }, orderBy: [{ order: "asc" }, { createdAt: "asc" }] });
    return rows.map((row) => ({ id: row.id, title: row.title, text: row.text, date: row.date, linkUrl: row.linkUrl, linkLabel: row.linkLabel }));
  });
}

export function listPublicGallery(): Promise<KadikGalleryItemView[]> {
  return safely([], async () => {
    const rows = await prisma.kadikGalleryItem.findMany({ where: { published: true }, orderBy: [{ order: "asc" }, { createdAt: "asc" }] });
    const urls = await assetUrls(rows.map((row) => row.imageAssetId));
    return rows.map((row) => ({
      id: row.id,
      image: (row.imageAssetId && urls.get(row.imageAssetId)) || row.imageUrl,
      category: row.category,
      caption: row.caption,
    }));
  });
}

/* ------------------------------------------------------------ Validation */

const clean = (value: unknown, max = 500) => (typeof value === "string" ? value.trim().slice(0, max) : "");
const optional = (value: unknown, max = 500) => clean(value, max) || null;

function safeUrl(value: unknown, label: string): string | null {
  const url = clean(value, 2000);
  if (!url) return null;
  if (!/^(https?:\/\/|mailto:|\/)/i.test(url)) throw new KadikContentError(`${label} https://, mailto: ya da / ile başlamalı.`);
  return url;
}

async function resolveAsset(assetId: unknown): Promise<{ id: string; url: string } | null> {
  const id = clean(assetId, 64);
  if (!id) return null;
  const asset = await prisma.mediaAsset.findUnique({ where: { id }, select: { id: true, url: true, archivedAt: true } });
  if (!asset) throw new KadikContentError("Seçilen görsel bulunamadı.");
  if (asset.archivedAt) throw new KadikContentError("Arşivlenmiş görsel kullanılamaz.");
  return { id: asset.id, url: asset.url };
}

/* ------------------------------------------------------------------ Events */

export type KadikEventInput = Readonly<{
  title: string;
  date: string;
  startTime?: string;
  endTime?: string;
  location?: string;
  description?: string;
  imageAssetId?: string | null;
  registrationUrl?: string;
  published: boolean;
}>;

export async function saveKadikEvent(id: string | null, input: KadikEventInput, actorId: string): Promise<string> {
  const title = clean(input.title, 200);
  if (!title) throw new KadikContentError("Etkinlik başlığı zorunlu.");
  const date = clean(input.date, 10);
  if (!DATE_PATTERN.test(date)) throw new KadikContentError("Geçerli bir tarih seçin.");
  const startTime = optional(input.startTime, 5);
  const endTime = optional(input.endTime, 5);
  if (startTime && !TIME_PATTERN.test(startTime)) throw new KadikContentError("Başlangıç saati SS:DD biçiminde olmalı.");
  if (endTime && !TIME_PATTERN.test(endTime)) throw new KadikContentError("Bitiş saati SS:DD biçiminde olmalı.");
  if (startTime && endTime && endTime <= startTime) throw new KadikContentError("Bitiş saati başlangıçtan sonra olmalı.");
  const html = sanitizeRichHtml(clean(input.description, 20_000));
  const description = stripHtmlToText(html).trim() ? html : null;
  const asset = await resolveAsset(input.imageAssetId);
  const data = {
    title,
    date,
    startTime,
    endTime,
    location: optional(input.location, 300),
    description,
    imageAssetId: asset?.id ?? null,
    imageUrl: asset?.url ?? null,
    registrationUrl: safeUrl(input.registrationUrl, "Kayıt bağlantısı"),
    published: Boolean(input.published),
  };

  return prisma.$transaction(async (tx) => {
    const row = id ? await tx.kadikEvent.update({ where: { id }, data }) : await tx.kadikEvent.create({ data });
    await tx.mediaUsage.deleteMany({ where: { surface: EVENT_MEDIA_SURFACE, field: row.id } });
    if (asset) await tx.mediaUsage.create({ data: { assetId: asset.id, surface: EVENT_MEDIA_SURFACE, field: row.id } });
    await tx.auditLog.create({ data: { action: id ? "kadik.event.update" : "kadik.event.create", entity: "KadikEvent", entityId: row.id, userId: actorId, metadata: { published: data.published } } });
    return row.id;
  });
}

export async function deleteKadikEvent(id: string, actorId: string): Promise<void> {
  await prisma.$transaction([
    prisma.mediaUsage.deleteMany({ where: { surface: EVENT_MEDIA_SURFACE, field: id } }),
    prisma.kadikEvent.delete({ where: { id } }),
    prisma.auditLog.create({ data: { action: "kadik.event.delete", entity: "KadikEvent", entityId: id, userId: actorId } }),
  ]);
}

/* ---------------------------------------------------------- Announcements */

export type KadikAnnouncementInput = Readonly<{
  title: string;
  text: string;
  date?: string;
  linkUrl?: string;
  linkLabel?: string;
  published: boolean;
}>;

export async function saveKadikAnnouncement(id: string | null, input: KadikAnnouncementInput, actorId: string): Promise<string> {
  const title = clean(input.title, 200);
  if (!title) throw new KadikContentError("Duyuru başlığı zorunlu.");
  const date = optional(input.date, 10);
  if (date && !DATE_PATTERN.test(date)) throw new KadikContentError("Geçerli bir tarih seçin.");
  const data = {
    title,
    text: clean(input.text, 5000),
    date,
    linkUrl: safeUrl(input.linkUrl, "Bağlantı"),
    linkLabel: optional(input.linkLabel, 80),
    published: Boolean(input.published),
  };
  const row = id
    ? await prisma.kadikAnnouncement.update({ where: { id }, data })
    : await prisma.kadikAnnouncement.create({ data: { ...data, order: (await prisma.kadikAnnouncement.count()) } });
  await prisma.auditLog.create({ data: { action: id ? "kadik.announcement.update" : "kadik.announcement.create", entity: "KadikAnnouncement", entityId: row.id, userId: actorId } });
  return row.id;
}

export async function deleteKadikAnnouncement(id: string, actorId: string): Promise<void> {
  await prisma.$transaction([
    prisma.kadikAnnouncement.delete({ where: { id } }),
    prisma.auditLog.create({ data: { action: "kadik.announcement.delete", entity: "KadikAnnouncement", entityId: id, userId: actorId } }),
  ]);
}

export async function reorderKadikAnnouncements(ids: readonly string[], actorId: string): Promise<void> {
  await prisma.$transaction([
    ...ids.map((id, order) => prisma.kadikAnnouncement.update({ where: { id }, data: { order } })),
    prisma.auditLog.create({ data: { action: "kadik.announcement.reorder", entity: "KadikAnnouncement", userId: actorId, metadata: { count: ids.length } } }),
  ]);
}

/* ---------------------------------------------------------------- Gallery */

export type KadikGalleryInput = Readonly<{
  id?: string | null;
  imageAssetId?: string | null;
  imageUrl?: string;
  category: string;
  caption: string;
  published: boolean;
}>;

/**
 * Replaces the whole gallery in one transaction - order is the array
 * order. Images must be library assets; a bundled photo that shipped with
 * the site may be kept as is but never entered by hand.
 */
export async function saveKadikGallery(items: readonly KadikGalleryInput[], actorId: string): Promise<void> {
  const existing = await prisma.kadikGalleryItem.findMany({ select: { id: true, imageUrl: true, imageAssetId: true } });
  const bundled = new Set(existing.filter((row) => !row.imageAssetId).map((row) => row.imageUrl));
  const assets = await assetUrls(items.map((item) => clean(item.imageAssetId, 64) || null));
  const rows = items.slice(0, 500).map((item, order) => {
    const assetId = clean(item.imageAssetId, 64) || null;
    const url = assetId ? assets.get(assetId) : clean(item.imageUrl, 2000);
    if (assetId && !url) throw new KadikContentError("Galeride bulunamayan ya da arşivlenmiş bir görsel var.");
    if (!assetId && (!url || !bundled.has(url))) throw new KadikContentError("Görseller yalnızca medya kütüphanesinden eklenebilir.");
    return {
      id: clean(item.id, 64) || null,
      imageAssetId: assetId,
      imageUrl: url as string,
      category: clean(item.category, 80),
      caption: clean(item.caption, 300),
      order,
      published: Boolean(item.published),
    };
  });
  const keepIds = new Set(rows.flatMap((row) => (row.id ? [row.id] : [])));

  await prisma.$transaction(async (tx) => {
    await tx.kadikGalleryItem.deleteMany({ where: { id: { notIn: [...keepIds] } } });
    for (const { id, ...data } of rows) {
      if (id && existing.some((row) => row.id === id)) await tx.kadikGalleryItem.update({ where: { id }, data });
      else await tx.kadikGalleryItem.create({ data });
    }
    await tx.mediaUsage.deleteMany({ where: { surface: GALLERY_MEDIA_SURFACE } });
    const usages = rows.flatMap((row) => (row.imageAssetId ? [{ assetId: row.imageAssetId, surface: GALLERY_MEDIA_SURFACE, field: "gallery" }] : []));
    if (usages.length) await tx.mediaUsage.createMany({ data: usages });
    await tx.auditLog.create({ data: { action: "kadik.gallery.save", entity: "KadikGalleryItem", userId: actorId, metadata: { count: rows.length } } });
  });
}

/* ------------------------------------------------------------------ Admin */

export type AdminEventRow = Readonly<{
  id: string;
  title: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  location: string | null;
  description: string | null;
  imageAssetId: string | null;
  imageUrl: string | null;
  registrationUrl: string | null;
  published: boolean;
}>;

export async function listAdminEvents(): Promise<AdminEventRow[]> {
  const rows = await prisma.kadikEvent.findMany({ orderBy: [{ date: "desc" }, { startTime: "desc" }] });
  const urls = await assetUrls(rows.map((row) => row.imageAssetId));
  return rows.map((row) => ({ ...pickEvent(row), imageUrl: (row.imageAssetId && urls.get(row.imageAssetId)) || row.imageUrl }));
}

export async function getAdminEvent(id: string): Promise<AdminEventRow | null> {
  const row = await prisma.kadikEvent.findUnique({ where: { id } });
  if (!row) return null;
  const urls = await assetUrls([row.imageAssetId]);
  return { ...pickEvent(row), imageUrl: (row.imageAssetId && urls.get(row.imageAssetId)) || row.imageUrl };
}

function pickEvent(row: EventRow): AdminEventRow {
  return {
    id: row.id,
    title: row.title,
    date: row.date,
    startTime: row.startTime,
    endTime: row.endTime,
    location: row.location,
    description: row.description,
    imageAssetId: row.imageAssetId,
    imageUrl: row.imageUrl,
    registrationUrl: row.registrationUrl,
    published: row.published,
  };
}

export type AdminAnnouncementRow = Readonly<{
  id: string;
  title: string;
  text: string;
  date: string | null;
  linkUrl: string | null;
  linkLabel: string | null;
  published: boolean;
}>;

export async function listAdminAnnouncements(): Promise<AdminAnnouncementRow[]> {
  const rows = await prisma.kadikAnnouncement.findMany({ orderBy: [{ order: "asc" }, { createdAt: "asc" }] });
  return rows.map(({ id, title, text, date, linkUrl, linkLabel, published }) => ({ id, title, text, date, linkUrl, linkLabel, published }));
}

export async function getAdminAnnouncement(id: string): Promise<AdminAnnouncementRow | null> {
  const row = await prisma.kadikAnnouncement.findUnique({ where: { id } });
  return row ? { id: row.id, title: row.title, text: row.text, date: row.date, linkUrl: row.linkUrl, linkLabel: row.linkLabel, published: row.published } : null;
}

export type AdminGalleryRow = Readonly<{
  id: string;
  imageAssetId: string | null;
  imageUrl: string;
  category: string;
  caption: string;
  published: boolean;
}>;

export async function listAdminGallery(): Promise<AdminGalleryRow[]> {
  const rows = await prisma.kadikGalleryItem.findMany({ orderBy: [{ order: "asc" }, { createdAt: "asc" }] });
  const urls = await assetUrls(rows.map((row) => row.imageAssetId));
  return rows.map((row) => ({
    id: row.id,
    imageAssetId: row.imageAssetId,
    imageUrl: (row.imageAssetId && urls.get(row.imageAssetId)) || row.imageUrl,
    category: row.category,
    caption: row.caption,
    published: row.published,
  }));
}
