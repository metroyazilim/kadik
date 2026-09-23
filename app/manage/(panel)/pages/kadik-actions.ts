"use server";

import { revalidatePath } from "next/cache";
import { resolveAdminContext } from "@/lib/content-model/admin-context";
import { KADIK_PAGE_DEFINITIONS, isKadikContentKey, kadikPageDefaults } from "@/lib/kadik-content/pages";
import { KadikContentError, saveKadikPage, saveKadikSeo } from "@/lib/kadik-content/store";

export type KadikPageActionResult = Readonly<{ ok: boolean; message: string }>;

function revalidateKadikPage(key: string) {
  revalidatePath("/manage/pages");
  revalidatePath(`/manage/pages/${key}`);
  // Header/footer appear on every page; other pages only on their own URL.
  revalidatePath("/", "layout");
}

export async function saveKadikPageAction(key: string, data: unknown): Promise<KadikPageActionResult> {
  try {
    const context = await resolveAdminContext();
    if (!isKadikContentKey(key)) return { ok: false, message: "Geçersiz sayfa." };
    await saveKadikPage(key, data, context.actorId, { keepStoredSeo: true });
    revalidateKadikPage(key);
    return { ok: true, message: `${KADIK_PAGE_DEFINITIONS[key].label} kaydedildi. Değişiklik sitede yayında.` };
  } catch (error) {
    if (error instanceof KadikContentError) return { ok: false, message: error.message };
    console.error("saveKadikPageAction failed", error);
    return { ok: false, message: "Sayfa kaydedilemedi. Lütfen tekrar deneyin." };
  }
}

/** Restores the content that shipped with the site (the state before any admin edit). */
export async function resetKadikPageAction(key: string): Promise<KadikPageActionResult> {
  try {
    const context = await resolveAdminContext();
    if (!isKadikContentKey(key)) return { ok: false, message: "Geçersiz sayfa." };
    await saveKadikPage(key, kadikPageDefaults(key), context.actorId, { keepStoredSeo: true });
    revalidateKadikPage(key);
    return { ok: true, message: "Sayfa ilk hâline döndürüldü." };
  } catch (error) {
    console.error("resetKadikPageAction failed", error);
    return { ok: false, message: "Sayfa sıfırlanamadı." };
  }
}

export async function saveKadikSeoAction(
  key: string,
  seo: { title: string; description: string; image: { url: string; assetId: string | null } },
): Promise<KadikPageActionResult> {
  try {
    const context = await resolveAdminContext();
    if (!isKadikContentKey(key)) return { ok: false, message: "Geçersiz sayfa." };
    await saveKadikSeo(
      key,
      { title: String(seo.title ?? "").trim(), description: String(seo.description ?? "").trim(), image: seo.image },
      context.actorId,
    );
    revalidateKadikPage(key);
    revalidatePath("/manage/seo");
    return { ok: true, message: `${KADIK_PAGE_DEFINITIONS[key].label} SEO ayarları kaydedildi.` };
  } catch (error) {
    if (error instanceof KadikContentError) return { ok: false, message: error.message };
    console.error("saveKadikSeoAction failed", error);
    return { ok: false, message: "SEO ayarları kaydedilemedi." };
  }
}
