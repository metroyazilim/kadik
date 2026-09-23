"use server";

import { revalidatePath } from "next/cache";
import { resolveAdminContext } from "@/lib/content-model/admin-context";
import {
  deleteKadikAnnouncement,
  deleteKadikEvent,
  reorderKadikAnnouncements,
  saveKadikAnnouncement,
  saveKadikEvent,
  saveKadikGallery,
  type KadikAnnouncementInput,
  type KadikEventInput,
  type KadikGalleryInput,
} from "@/lib/kadik-content/collections";
import { KadikContentError } from "@/lib/kadik-content/store";

export type CollectionActionResult = Readonly<{ ok: boolean; message: string; id?: string }>;

function failure(error: unknown, fallback: string): CollectionActionResult {
  if (error instanceof KadikContentError) return { ok: false, message: error.message };
  console.error(fallback, error);
  return { ok: false, message: fallback };
}

function refresh(adminPath: string, publicPath: string) {
  revalidatePath(adminPath, "layout");
  revalidatePath(publicPath);
  revalidatePath("/manage");
}

/* Events */

export async function saveEventAction(id: string | null, input: KadikEventInput): Promise<CollectionActionResult> {
  try {
    const context = await resolveAdminContext();
    const savedId = await saveKadikEvent(id, input, context.actorId);
    refresh("/manage/events", "/events");
    return { ok: true, message: input.published ? "Etkinlik kaydedildi ve sitede yayında." : "Etkinlik kaydedildi (sitede gizli).", id: savedId };
  } catch (error) {
    return failure(error, "Etkinlik kaydedilemedi.");
  }
}

export async function deleteEventAction(id: string): Promise<CollectionActionResult> {
  try {
    const context = await resolveAdminContext();
    await deleteKadikEvent(id, context.actorId);
    refresh("/manage/events", "/events");
    return { ok: true, message: "Etkinlik silindi." };
  } catch (error) {
    return failure(error, "Etkinlik silinemedi.");
  }
}

/* Announcements */

export async function saveAnnouncementAction(id: string | null, input: KadikAnnouncementInput): Promise<CollectionActionResult> {
  try {
    const context = await resolveAdminContext();
    const savedId = await saveKadikAnnouncement(id, input, context.actorId);
    refresh("/manage/announcements", "/announcements");
    return { ok: true, message: input.published ? "Duyuru kaydedildi ve sitede yayında." : "Duyuru kaydedildi (sitede gizli).", id: savedId };
  } catch (error) {
    return failure(error, "Duyuru kaydedilemedi.");
  }
}

export async function deleteAnnouncementAction(id: string): Promise<CollectionActionResult> {
  try {
    const context = await resolveAdminContext();
    await deleteKadikAnnouncement(id, context.actorId);
    refresh("/manage/announcements", "/announcements");
    return { ok: true, message: "Duyuru silindi." };
  } catch (error) {
    return failure(error, "Duyuru silinemedi.");
  }
}

export async function reorderAnnouncementsAction(ids: readonly string[]): Promise<CollectionActionResult> {
  try {
    const context = await resolveAdminContext();
    await reorderKadikAnnouncements(ids, context.actorId);
    refresh("/manage/announcements", "/announcements");
    return { ok: true, message: "Sıra kaydedildi." };
  } catch (error) {
    return failure(error, "Sıra kaydedilemedi.");
  }
}

/* Gallery */

export async function saveGalleryAction(items: readonly KadikGalleryInput[]): Promise<CollectionActionResult> {
  try {
    const context = await resolveAdminContext();
    await saveKadikGallery(items, context.actorId);
    refresh("/manage/gallery", "/gallery");
    return { ok: true, message: "Galeri kaydedildi ve sitede yayında." };
  } catch (error) {
    return failure(error, "Galeri kaydedilemedi.");
  }
}
